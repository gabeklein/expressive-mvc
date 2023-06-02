import { Control, control } from './control';
import { Debug } from './debug';
import { defineProperties, defineProperty } from './helper/object';
import { get } from './model-get';
import { use } from './model-use';
import { getMethod, Observable, setMethod } from './observable';

import type { Callback } from '../types';

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

declare namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A typeof Model, specifically one which can be created without any arguments. */
  export type New<T extends Model = Model> = (new () => T) & typeof Model;

  export type Effect<T> = (this: T, argument: T) => Callback | Promise<any> | void;

  /** Exotic value, actual value is contained. */
  export type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /**
   * Subset of `keyof T` which are not methods or defined by base Model U.
   **/
  export type Key<T, U = Model> = Extract<Exclude<keyof T, keyof U | keyof Debug>, string>;

  /** Including but not limited to `keyof T` which are not methods or defined by base Model. */
  export type Event<T> = Key<T> | (string & {});

  /** Actual value stored in state. */
  export type Value<R> = R extends Ref<infer T> ? T : R;

  /** Actual value belonging to a managed property. */
  export type ValueOf<T extends {}, K> = K extends keyof T ? Value<T[K]> : undefined;

  export type Export<T> = { [P in Key<T>]: Value<T[P]> };

  /** Object containing managed entries found in T. */
  export type Entries<T> = { [K in Key<T>]: T[K] };

  /** Object comperable to data found in T. */
  export type Compat<T> = { [K in Key<T>]?: T[K] };

  /**
   * Values from current state of given controller.
   * 
   * Differs from `Entries` as values here will drill into "real" values held by exotics like ref.
   */
  export type Get<T, K extends Key<T> = Key<T>> = { [P in K]: Value<T[P]> };

  /** Promise thrown by something which is not yet ready. */
  export type Suspense = Promise<void> & Error;
}

interface Model extends Observable {}

class Model {
  constructor(id?: string | number){
    new Control(this, id);
  }

  /**
   * Reference to `this` without a subscription.
   * Use to obtain full reference from a destructure.
   */
  get is(){
    // debugger
    return this;
  }

  /** Mark this instance for garbage collection. */
  null(){
    control(this, true).clear();
  }

  static get = get;
  static use = use;

  /**
   * Creates a new instance of this controller.
   * 
   * Beyond `new this(...)`, method will activate managed-state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends new (...args: any[]) => any> (
    this: T, ...args: ConstructorParameters<T>): InstanceOf<T> {

    const instance = new this(...args);
    control(instance, true);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * 
   * Will determine if provided class is a subtype of this one. 
   */
  static isTypeof<T extends Model.Type>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

defineProperties(Model.prototype, {
  get: { value: getMethod },
  set: { value: setMethod },
  on: {
    configurable: true,
    writable: true,
    value(){
      // TODO: Remove this method on 1.0
      throw new Error("Model.on() is deprecated. Use Model.get or Model.set instead.")
    }
  },
  toString: {
    configurable: true,
    value(){
      return `${this.constructor.name}-${control(this).id}`;
    }
  }
})

defineProperty(Model, "toString", {
  value(){
    return this.name;
  }
})

export { Model }