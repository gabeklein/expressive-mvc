import { Controller } from './controller';
import { LOCAL, Stateful } from './model';
import { Subscriber } from './subscriber';
import { defineProperty } from './util';

export const Pending = new Map<symbol, Instruction<any>>();

declare namespace Instruction {
  type Getter<T> = (state: T | undefined, within?: Subscriber) => T;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?(value: T, state: any): boolean | void;
  }
}

export type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
  void | Instruction.Getter<T> | Instruction.Descriptor<T>;

export function apply<T = any>(
  fn: Instruction<any>, label?: string){

  const name = label || fn.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Controller, key: string){
    const { subject, state } = this;

    let output = fn.call(this, key, this);
    let desc = {} as PropertyDescriptor;
    let get: ((state: any, within?: Subscriber | undefined) => any) | undefined;
    let set: ((value: any, state: any) => boolean | void) | undefined

    if(!output)
      return;

    if(typeof output == "function")
      get = output;

    else {
      ({ get, set, ...desc } = output);

      if("value" in desc){
        state[key] = desc.value;
        
        if(get || set)
          delete desc.value;
        else {
          defineProperty(subject, key, desc);
          return;
        }
      }
    }

    defineProperty(subject, key, {
      ...desc,
      set: this.ref(key, set),
      get: get
        ? function(this: Stateful){
          return get!(state[key], this[LOCAL]);
        }
        : () => state[key]
    });
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}