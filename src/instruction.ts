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

    let getter: ((state: any, within?: Subscriber | undefined) => any) | undefined;
    let setter: ((value: any, state: any) => boolean | void) | undefined

    if(!output)
      return;

    if(typeof output == "function")
      getter = output;

    else {
      getter = output.get;
      setter = output.set;

      if(output.enumerable)
        desc.enumerable = true;

      if(output.configurable)
        desc.configurable = true;

      if("value" in output){
        state[key] = output.value;
        
        if(!getter && !setter){
          defineProperty(subject, key, {
            value: output.value
          });
          return;
        }
      }
    }

    const set = this.setter(key, setter);
    const get = getter
    ? function(this: Stateful){
      return getter!(state[key], this[LOCAL]);
    }
    : () => state[key];

    defineProperty(subject, key, {
      ...desc, get, set
    });
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}