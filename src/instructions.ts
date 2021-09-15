import * as Computed from './compute';
import { Controller, LOCAL, Stateful } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

type GetFunction<T> = (sub?: Subscriber) => T;
type Instruction<T> = (this: Controller, key: string) =>
    void | GetFunction<T> | PropertyDescriptor;

export const Pending = new Map<symbol, Instruction<any>>();

export function apply(
  on: Controller, key: string, value: symbol){

  const instruction = Pending.get(value);

  if(instruction){
    Pending.delete(value);
    delete (on.subject as any)[key];
    instruction.call(on, key);
    return true;
  }
}

export function set<T = any>(
  instruction: Instruction<T>,
  name = instruction.name || "pending"){

  const placeholder = Symbol(`${name} instruction`);

  function apply(this: Controller, key: string){
    let output = instruction.call(this, key);

    if(typeof output == "function"){
      const getter = output;

      output = {
        ...getOwnPropertyDescriptor(this.subject, key),
        get(this: Stateful){
          return getter(this[LOCAL])
        }
      }
    }

    if(output)
      defineProperty(this.subject, key, output);
  }

  Pending.set(placeholder, apply);

  return placeholder as unknown as T;
}

export const ref = <T = any>(
  cb?: EffectCallback<Model, any>): { current: T } => set(

  function ref(key){
    const refObjectFunction =
      this.sets(key, cb && createEffect(cb));

    defineProperty(refObjectFunction, "current", {
      set: refObjectFunction,
      get: () => this.state[key]
    })

    return {
      value: refObjectFunction
    };
  }
);

export const on = <T = any>(
  value: T, cb: EffectCallback<Model, T>): T => set(

  function on(key){
    this.manage(key, value, cb && createEffect(cb));
  }
);

export const memo = <T>(
  factory: () => T, defer?: boolean): T => set(

  function memo(key){
    const source = this.subject;
    const get = () => factory.call(source);

    if(defer)
      defineLazy(source, key, get);
    else
      define(source, key, get())
  }
);

export const lazy = <T>(value: T): T => set(
  function lazy(key){
    const source = this.subject as any;

    source[key] = value;
    defineProperty(this.state, key, {
      get: () => source[key]
    });
  }
);

export const act = <T extends Async>(task: T): T => set(
  function act(key){
    let pending = false;

    const invoke = (...args: any[]) => {
      if(pending)
        return Promise.reject(
          Oops.DuplicateAction(key)
        )

      pending = true;
      this.update(key);

      return new Promise(res => {
        res(task.apply(this.subject, args));
      }).finally(() => {
        pending = false;
        this.update(key);
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
  }
)

export const from = <T>(
  getter: (on?: Model) => T): T => set(

  function from(key){
    Computed.prepare(this, key, getter);
  }
);