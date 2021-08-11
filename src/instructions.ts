import * as Computed from './compute';
import { Controller } from './controller';
import { issues } from './issues';
import { LOCAL, Model, Stateful } from './model';
import { Subscriber } from './subscriber';
import { define, defineLazy, defineProperty, getOwnPropertyDescriptor, memoize, setAlias } from './util';

export const Oops = issues({
  DuplicateAction: (key) =>
    `Invoked action ${key} but one is already active.`
})

type GetFunction<T> = (sub?: Subscriber) => T;
type Instruction<T> = (this: Controller, key: string) =>
    void | GetFunction<T> | PropertyDescriptor;

export const Pending = new Map<symbol, Instruction<any>>();

export function declare<T = any>(
  instruction: Instruction<T>,
  perSubscriber?: boolean,
  name = instruction.name || "pending"){

  const placeholder = Symbol(`${name} instruction`);

  function apply(this: Controller, key: string){
    let output = instruction.call(this, key);

    if(typeof output == "function"){
      const getter: GetFunction<T> =
        perSubscriber ? memoize(output) : output;

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

export function ref<T = any>(
  effect?: EffectCallback<Model, any>): { current: T } {

  return declare(
    function ref(key){
      const refObjectFunction = this.sets(key, effect);

      defineProperty(refObjectFunction, "current", {
        set: refObjectFunction,
        get: () => this.state[key]
      })

      return { value: refObjectFunction };
    }
  );
}

export function on<T = any>(
  value: any, effect?: EffectCallback<Model, T>): T {

  return declare(
    function on(key){
      if(!effect){
        effect = value;
        value = undefined;
      }
  
      this.manage(key, value, effect);
    }
  );
}

export function memo<T>(factory: () => T, defer?: boolean): T {
  return declare(
    function memo(key){
      const source = this.subject;
      const get = () => factory.call(source);
  
      if(defer)
        defineLazy(source, key, get);
      else
        define(source, key, get())
    }
  );
}

export function lazy<T>(value: T): T {
  return declare(
    function lazy(key){
      const source = this.subject as any;
  
      source[key] = value;
      defineProperty(this.state, key, {
        get: () => source[key]
      });
    }
  );
}

export function act<T extends Async>(task: T): T {
  return declare(
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
  );
}

export function from<T>(getter: (on?: Model) => T): T {
  return declare(
    function from(key){
      Computed.prepare(this, key, getter);
    }
  );
}