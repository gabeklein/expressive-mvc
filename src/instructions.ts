import { prepareComputed } from './compute';
import { set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { alias, define, defineLazy, defineProperty } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

export function ref<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return set((on, key) => {
    const refObjectFunction = on.setter(key, effect);

    defineProperty(refObjectFunction, "current", {
      set: refObjectFunction,
      get: () => on.state[key]
    })

    return {
      value: refObjectFunction
    };
  })
}

export function on<T = any>
  (value: any, effect?: EffectCallback<Model, T>): T {

  return set((on, key) => {
    if(!effect){
      effect = value;
      value = undefined;
    }

    on.register(key, value, effect);
  })
}

export function memo
  (factory: () => any, defer?: boolean){

  return set(({ subject }, key) => {
    const get = () => factory.call(subject);

    if(defer)
      defineLazy(subject, key, get);
    else
      define(subject, key, get())
  }) 
}

export function lazy(value: any){
  return set(({ state, subject }, key) => {
    subject[key] = value;
    defineProperty(state, key, {
      get: () => subject[key]
    });
  })
}

type AsyncFn<T = any> = (...args: any[]) => Promise<T>;

export function act(does: AsyncFn){
  return set((on, key) => {
    let pending = false;

    function invoke(...args: any[]){
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      on.update(key);

      return does
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

    return {
      value: invoke,
      writable: false
    };
  })
}

export function from(fn: (on?: Model) => any){
  return set((on, key) => {
    prepareComputed(on, key, fn);
  })
}