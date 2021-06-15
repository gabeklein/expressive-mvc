import type { Model } from './model';

import { Lookup } from './context';
import { Controller } from './controller';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { alias, define, defineLazy, defineProperty } from './util';

import Oops from './issues';

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const instance = new Peer() as InstanceOf<T>;

    define(subject, key, instance);

    ParentRelationship.set(instance, subject);
    Controller.get(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
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

export const PendingContext = new Set<(context: Lookup) => void>();

export function setPeer<T extends typeof Model>
  (Peer: T, required?: boolean): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const Self = subject.constructor.name;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find(true));
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else {
      function insert(context: Lookup){
        const remote = context.get(Peer);

        if(!remote && required)
          throw Oops.AmbientRequired(Peer.name, Self, key);

        define(subject, key, remote);
      }

      PendingContext.add(insert);
      define(subject, key, insert);
    }
  })
}

export function setRefObject<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return Observer.define((key, on) => {
    on.assign(key, {
      value: defineProperty({}, "current", {
        get: () => on.state[key],
        set: on.setter(key, effect)
      })
    });
  })
}

export function setEffect<T = any>
  (value: any, effect?: EffectCallback<Model, T>): T {

  return Observer.define((key, on) => {
    if(!effect){
      effect = value;
      value = undefined;
    }

    on.monitorValue(key, value, effect);
  })
}

export function setMemo(factory: () => any, defer?: boolean){
  return Observer.define((key, { subject }) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function setIgnored(value: any){
  return Observer.define((key, on) => {
    const real = on.subject as any;

    real[key] = value;
    define(on.state, key, {
      get: () => real[key]
    });
  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function setAction(action: AsyncFn){
  return Observer.define((key, on) => {
    let pending = false;

    function invoke(...args: any[]){
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      on.update(key);

      return action
        .apply(on.subject, args)
        .finally(() => {
          pending = false;
          on.update(key);
        })
    };

    alias(invoke, `run ${key}`);
    defineProperty(invoke, "active", {
      get: () => pending
    })

    on.assign(key, {
      get: () => invoke,
      set: () => {
        throw Oops.SetActionProperty(key);
      }
    });
  })
}