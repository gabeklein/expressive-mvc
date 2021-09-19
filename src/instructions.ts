import * as Computed from './compute';
import { Instruction, does, LOCAL, Stateful } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { createEffect, define, defineLazy, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

export const set = <T = any>(
  instruction: Instruction<T>, name?: string): T => does(

  function set(key){
    let output = instruction.call(this, key, this);

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
  }, 
  name || instruction.name || "pending"
)

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