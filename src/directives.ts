import type { Controller, Model } from './controller';

import { Dispatch } from './dispatch';
import { Singleton } from './singleton';
import { createEffect, define, defineLazy, defineProperty, traceable } from './util';

import Oops from './issues';

type DispatchFactory = (on: Dispatch, key: string) => void;

export class Pending {
  constructor(
    public applyTo: DispatchFactory
  ){}

  static define(init: DispatchFactory): any {
    return new Pending(init)
  }
}

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return Pending.define(({ subject }, key) => {
    const instance = new Peer() as InstanceOf<T>;

    define(subject, key, instance);

    ParentRelationship.set(instance, subject);
    Dispatch.get(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return Pending.define(({ subject }, key) => {
    const expectsType = Expects.name;
    const onType = subject.constructor.name;
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects)){
      const gotType = parent.constructor.name;
      throw Oops.UnexpectedParent(expectsType, onType, gotType);
    }

    define(subject, key, parent);
  })
}

export function setPeer<T extends Model>
  (Peer: T): InstanceOf<T> {

  return Pending.define(({ subject }, key) => {
    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find(true));
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else
      define(subject, key, Peer);
  })
}

export function setRefObject<T = any>
  (effect?: EffectCallback<Controller, any>): { current: T } {

  return Pending.define((on, key) => {
    on.watched.add(key);
    on.assign(key, {
      value: defineProperty({}, "current", {
        get: on.getter(key),
        set: on.setter(key,
          effect && createEffect(effect)
        )
      })
    });
  })
}

export function setEffect<T = any>
  (value: any, effect?: EffectCallback<Controller, T>): T {

  if(!effect){
    effect = value;
    value = undefined;
  }

  return Pending.define((on, key) => {
    on.monitorValue(key, value, createEffect(effect!));
  })
}

export function setEvent
  (callback?: EffectCallback<Controller>){

  return Pending.define((on, key) => {
    on.watched.add(key);
    on.assign(key, {
      value: () => on.emit(key)
    })

    if(callback)
      on.effect(callback, [key]);
  })
}

export function setMemo
  (factory: () => any, defer?: boolean){

  return Pending.define(({ subject }, key) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function setIgnored(value: any){
  return Pending.define((on, key) => {
    (on.subject as any)[key] = value;
  })
}

export function setTuple<T extends any[]>
  (...values: T): T {

  if(values.length == 0)
    values = undefined as any;
  else if(values.length == 1 && typeof values[0] == "object")
    values = values[0] as any;
  
  return Pending.define((on, key) => {
    const source = on.state;

    const setTuple = (next: any) => {
      const current: any = source[key];
      let update = false;

      if(!current){
        update = true;
        source[key] = current;
      }
      else 
        for(const k in current)
          if(current[k] !== next[k]){
            current[k] = next[k];
            update = true;
          }

      if(update)
        on.emit(key);
    };

    traceable(`set ${key}`, setTuple);

    source[key] = values;
    on.watched.add(key);
    on.assign(key, {
      get: on.getter(key),
      set: setTuple
    });

  })
}

export function setAction(action: AsyncFn){
  return Pending.define((on, key) => {
    let pending = false;

    function invoke(...args: any[]){
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      on.emit(key);

      return action
        .apply(on.subject, args)
        .finally(() => {
          pending = false;
          on.emit(key);
        })
    };

    traceable(`run ${key}`, invoke);
    defineProperty(invoke, "active", {
      get: () => pending
    })

    on.watched.add(key);
    on.assign(key, {
      get: () => invoke,
      set: () => {
        throw Oops.SetActionProperty(key);
      }
    });
  })
}