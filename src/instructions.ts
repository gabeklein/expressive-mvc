import { prepareComputed } from './compute';
import { Lookup } from './context';
import { Model, CONTROL } from './model';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { alias, define, defineLazy, defineProperty } from './util';

import Oops from './issues';

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return Observer.define((key, on) => {
    const instance = new Peer() as InstanceOf<T>;

    on.register(key, instance);
    ParentRelationship.set(instance, on.subject);

    // evaluating CONTROL to force inclusion by compiler
    if(instance[CONTROL] && callback)
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

export function setRefMediator<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return Observer.define((key, on) => {
    const refObjectFunction = on.setter(key, effect);

    defineProperty(refObjectFunction, "current", {
      set: refObjectFunction,
      get: () => on.state[key]
    })

    on.override(key, {
      value: refObjectFunction
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

    on.register(key, value, effect);
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

    on.override(key, {
      get: () => invoke,
      set: () => {
        throw Oops.SetActionProperty(key);
      }
    });
  })
}

export function setComputed(fn: (on?: Model) => any){
  return Observer.define((key, on) => {
    prepareComputed(on, key, fn);
  })
}