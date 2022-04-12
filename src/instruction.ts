import { Controller } from "./controller";
import { LOCAL, Stateful } from "./model";
import { Subscriber } from "./subscriber";
import { defineProperty, getOwnPropertyDescriptor } from "./util";

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
    let desc: PropertyDescriptor | undefined;

    if(!output)
      return;

    if(typeof output == "function"){
      const getter = output;

      desc = {
        set: this.setter(key),
        ...getOwnPropertyDescriptor(subject, key),
        get(this: Stateful){
          return getter(state[key], this[LOCAL])
        }
      }
    }
    else {
      const { get, set, value } = output;

      desc = {};

      if(output.enumerable)
        desc.enumerable = true;

      if(output.configurable)
        desc.configurable = true;

      if("value" in output){
        state[key] = value;
        
        if(!get && !set){
          defineProperty(subject, key, { value });
          return;
        }
      }

      desc!.get = get
        ? function(this: Stateful){
          return get(state[key], this[LOCAL]);
        }
        : () => state[key];

      desc!.set = this.setter(key, set);
    }

    defineProperty(subject, key, desc as any);
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}