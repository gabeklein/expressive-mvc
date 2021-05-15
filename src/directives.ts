import type { Controller as Public } from '..';
import type { Controller, Model } from './controller';

import { Dispatch } from './dispatch';
import { boundRefComponent, createHocFactory, withProvider } from './hoc';
import { Singleton } from './singleton';
import { createEffect, define, defineLazy, defineProperty, setDisplayName, within } from './util';

import Oops from './issues';

export class Pending {
  constructor(
    public applyTo: (on: Dispatch, key: string) => void,
    public loose?: boolean
  ){}

  static define(init: (on: Dispatch, key: string) => void, loose?: boolean): any {
    return new Pending(init, loose)
  }
}

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return Pending.define((on, key) => {
    const parent = on.subject;
    const instance = new Peer() as InstanceOf<T>;

    define(parent, key, instance);
    ParentRelationship.set(instance, parent);

    Dispatch.get(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return Pending.define((on, key) => {
    const { subject } = on;
    const { name: expectsType } = Expects;
    const { name: onType } = subject.constructor;
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

  return Pending.define((on, key) => {
    const subject = on.subject as Controller;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find());
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else
      define(subject, key, Peer);
  })
}

export function setReference<T = any>
  (effect?: EffectCallback<Controller, any>): { current: T } {

  return Pending.define((on, key) => {
    const reset = effect && createEffect(effect);

    on.register(key);
    on.override(key, {
      value: defineProperty({}, "current", {
        get: on.getter(key),
        set: on.setter(key, reset)
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
    const reset = createEffect(effect!);
    on.monitorValue(key, value, reset);
  })
}

export function setEvent
  (callback?: EffectCallback<Controller>){

  return Pending.define((on, key) => {
    on.register(key);
    on.override(key, {
      value: () => on.emit(key)
    })

    if(callback)
      on.effect(callback, [key]);
  })
}

export function setMemo
  (factory: () => any, defer?: boolean){

  return Pending.define((on, key) => {
    const get = () => factory.call(on.subject);

    if(defer)
      defineLazy(on.subject, key, get);
    else
      define(on.subject, key, get())
  }) 
}

export function setComponent
  (Type: Public.Component<{}>){

  const componentFor = createHocFactory(Type);

  return Pending.define((on, key) => {
    defineLazy(on.subject, key, () =>
      componentFor(on.subject as any)
    )
  })
}

export function setParentComponent
  (Type: Public.Component<{}>){

  const componentFor = createHocFactory(Type);

  return Pending.define((on, key) => {
    const control = on.subject as any;

    defineLazy(control, key, () => {
      const Component = componentFor(control);
      return withProvider(Component, control)
    })
  })
}

export function setBoundComponent
  (Type: Public.Component<{}, HTMLElement>, to: string){

  return Pending.define((on, key) => {
    const control = on.subject as Controller;
    const Component = boundRefComponent(control, to, Type);
    define(control, key, Component);
  })
}

export function setValue(value: any){
  return Pending.define((on, key) => {
    if(on.getters.has(key))
      return;
    else
      on.monitorValue(key, value);
  }, true)
}

export function setIgnored(value: any){
  return Pending.define((on, key) => {
    within(on.subject, key, value);
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
    }

    setDisplayName(setTuple, `set ${key}`);

    source[key] = values;
    on.register(key);
    on.override(key, {
      get: on.getter(key),
      set: setTuple
    });

  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function setAction(action: AsyncFn){
  return Pending.define((on, key) => {
    let pending = false;

    const run = async (...args: any[]) => {
      if(pending)
        throw Oops.DuplicateAction(key);

      pending = true;
      on.emit(key);

      return action
        .apply(on.subject, args)
        .finally(() => {
          pending = false;
          on.emit(key);
        })
    }

    defineProperty(run, "allowed", {
      get: () => !pending
    })

    on.register(key);
    on.override(key, {
      get: () => pending ? undefined : run,
      set: Oops.SetActionProperty(key).warn
    });
  })
}