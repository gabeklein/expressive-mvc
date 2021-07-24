import type Public from '../types';

import { prepareComputed } from './compute';
import { issues } from './issues';
import { LOCAL, Model, Stateful } from './model';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { assign, define, defineLazy, defineProperty, fn, getOwnPropertyDescriptor, setAlias } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

export const Pending = new WeakSet<Function>();

export function set(
  instruction: Public.Instruction<any>){

  Pending.add(instruction);
  return instruction as any;
}

export function runInstruction(
  on: Observer, key: string, value: any){

  if(!Pending.has(value))
    return;

  const target = on.subject as any;
  const using = value as Public.Instruction<any>;

  delete (target as any)[key];

  let describe = using(on, key);

  if(fn(describe)){
    const handle = describe as (sub: Subscriber | undefined) => any;
    const current = getOwnPropertyDescriptor(target, key) || {};

    describe = assign(current, {
      get(this: Stateful){
        return handle(this[LOCAL]);
      }
    });
  }

  if(describe)
    defineProperty(target, key, describe);

  return true;
}

export function ref<T = any>
  (effect?: EffectCallback<Model, any>): { current: T } {

  return set((on, key) => {
    const refObjectFunction = on.sets(key, effect);

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

    on.manage(key, value, effect);
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

export function act(task: Async){
  return set((on, key) => {
    let pending = false;

    async function invoke(...args: any[]){
      const run = async () =>
        task.apply(on.subject, args);

      if(pending)
        throw Oops.DuplicateAction(key);

      pending = true;
      on.update(key);

      return run().finally(() => {
        pending = false;
        on.update(key);
      })
    };

    setAlias(invoke, `run ${key}`);
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