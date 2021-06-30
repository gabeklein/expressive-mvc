import { prepareComputed } from './compute';
import { setup } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { alias, define, defineLazy, defineProperty } from './util';

export const Oops = issues({
  SetActionProperty: (key) =>
    `Attempted assignment of ${key}. This is not allowed because an action-property.`,

  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

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