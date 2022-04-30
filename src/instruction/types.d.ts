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
  | void;

declare namespace Instruction {
  type Getter<T> = (state: T | undefined, within?: Subscriber) => T;

  type Runner<T> = (this: Controller, key: string, on: Controller) => Instruction.Descriptor<T> | undefined;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?: ((value: T, state: any) => boolean | void) | false;
  }

  interface ExplicitDescriptor extends PropertyDescriptor {
    explicit: true;
  }
}

export { Instruction }