import { Controller } from "../controller";
import { Subscriber } from "../subscriber";

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
 void | Instruction.Getter<T> | Instruction.Descriptor<T>;

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

export { Instruction }