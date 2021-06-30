import { prepareComputed } from './compute';
import { Controller, setup } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { alias, define, defineLazy, defineProperty } from './util';

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got} but must be instanceof ${expects}`,

  SetActionProperty: (key) =>
    `Attempted assignment of ${key}. This is not allowed because an action-property.`,

  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

const ParentRelationship = new WeakMap<{}, {}>();

export function setChild<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  return setup((key, on) => {
    const instance = new Peer() as InstanceOf<T>;

    on.register(key, instance);
    ParentRelationship.set(instance, on.subject);

    Controller.get(instance);

    if(callback)
      callback(instance);
  })
}

export function setParent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return setup((key, { subject }) => {
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

export function setRefMediator<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return setup((key, on) => {
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

  return setup((key, on) => {
    if(!effect){
      effect = value;
      value = undefined;
    }

    on.register(key, value, effect);
  })
}

export function setMemo(factory: () => any, defer?: boolean){
  return setup((key, { subject }) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function setIgnored(value: any){
  return setup((key, on) => {
    const real = on.subject as any;

    real[key] = value;
    defineProperty(on.state, key, {
      get: () => real[key]
    });
  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function setAction(action: AsyncFn){
  return setup((key, on) => {
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
  return setup((key, on) => {
    prepareComputed(on, key, fn);
  })
}