import { Controller } from "../controller";
import { Subscriber } from "../subscriber";

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
  | Instruction.Getter<T> 
  | Instruction.ExplicitDescriptor
  | Instruction.Descriptor<T>
  | Instruction.RecursiveDescriptor<T>
  | boolean
  | void;

declare namespace Instruction {
  type Getter<T> = (state: T, within?: Subscriber) => T;
  type Setter<T> = (value: T, state: any) => boolean | void;

  type Runner<T> = (this: Controller, key: string, on: Controller) => Instruction.Descriptor<T> | boolean | undefined;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?: Setter<T> | false;
    suspense?: boolean;
  }

  interface ExplicitDescriptor extends PropertyDescriptor {
    explicit: true;
  }

  interface RecursiveDescriptor<T> {
    recursive: true;
    enumerable?: boolean;
    value?: T;
    set?: Setter<T> | false;
    suspense?: boolean;
  }
}

export { Instruction }