import { Control, control } from './control';
import { define } from './helper/object';
import { effect, extract, update } from './observe';

import type { Callback } from '../types';

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
type Class = new (...args: any[]) => any;
type Predicate = (key: string) => boolean | void;

namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A typeof Model, specifically one which can be created without any arguments. */
  export type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  export type Key<T> = Exclude<keyof T, keyof Model> & string;

  /** Actual value stored in state. */
  export type Value<R> =
    R extends Ref<infer T> ? T :
    R extends Model ? Export<R> :
    R;

  /** Object comperable to data found in T. */
  export type Values<T> = { [P in Key<T>]?: Value<T[P]> };

  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill into "real" values held by exotics like ref.
   */
  export type Export<T> = { [P in keyof T]: Value<T[P]> };

  /** Exotic value, where actual value is contained within. */
  export type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** A callback function which is subscribed to parent and updates when values change. */
  export type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | void;

  export type Event = (key: string) => Callback | void;
}

class Model {
  is!: this;

  constructor(id?: string | number){
    define(this, "is", { value: this });
    new Control(this, id);
  }

  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get(arg1?: Model.Effect<this>){
    return typeof arg1 == "function"
      ? effect(this, arg1)
      : extract(this);
  }

  /** Assert update is in progress. Returns a promise which resolves updated keys. */
  set (): Promise<Model.Values<this> | false>;

  /**
   * Expect an update to state within timeout.
   * 
   * @param timeout - milliseconds to wait for update
   * @param predicate - optional function to filter updates. If returns true, update is accepted.
   * 
   * @returns a promise which resolves full update.
   */
  set (timeout: number, predicate?: Predicate): Promise<Model.Values<this>>;

  /**
   * Call a function when an update to state has occured.
   * 
   * @param callback - Function to call when any update occurs. 
   *   Note: This will be called for every assignment which changes the value.
   *   To run logic on final value only, this callback may return a function.
   *   Returning the same function for the same (or multiple for that matter)
   *   will ensure it is only called once.
   *
   * @returns a function to remove listener
  */
  set (callback: Model.Event): Callback;

  set(arg1?: Model.Event | number, arg2?: Predicate){
    return typeof arg1 == "function"
      ? control(this, c => c.addListener(k => k && arg1(k)))
      : update(this, arg1, arg2);
    }

  /** Mark this instance for garbage collection. */
  null(){
    control(this).clear();
  }

  /**
   * Creates a new instance of this controller.
   * 
   * Beyond `new this(...)`, method will activate managed-state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends Class> (
    this: T, ...args: ConstructorParameters<T>
  ): InstanceOf<T> {
    const instance = new this(...args);
    control(instance, true);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Type>(this: T, maybe: any): maybe is T {
    return typeof maybe == "function" && maybe.prototype instanceof this;
  }
}

define(Model.prototype, "toString", {
  value(){
    return control(this).id;
  }
});

define(Model, "toString", {
  value(){
    return this.name;
  }
});

export { Model }