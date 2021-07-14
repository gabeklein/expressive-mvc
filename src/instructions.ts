import { prepareComputed } from './compute';
import { set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { alias, define, defineLazy, defineProperty } from './util';

export const Oops = issues({
  SetActionProperty: (key) =>
    `Attempted assignment of ${key}. Action properties do not allow this.`,

  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

export function setRefMediator<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return set((on, key) => {
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

  return set((on, key) => {
    if(!effect){
      effect = value;
      value = undefined;
    }

    on.register(key, value, effect);
  })
}

export function setMemo(factory: () => any, defer?: boolean){
  return set(({ subject }, key) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function setIgnored(value: any){
  return set((on, key) => {
    const real = on.subject as any;

    real[key] = value;
    defineProperty(on.state, key, {
      get: () => real[key]
    });
  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function setAction(action: AsyncFn){
  return set((on, key) => {
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
  return set((on, key) => {
    prepareComputed(on, key, fn);
  })
}