import { Control, control } from './control';
import { defineProperties, defineProperty } from './helper/object';
import { get } from './model-get';
import { use } from './model-use';
import { makeObservable } from './observable';

import type { Callback } from '../types';

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

declare namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A typeof Model, specifically one which can be created without any arguments. */
  export type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** A callback function which is subscribed to parent and updates when values change. */
  export type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | void;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  export type Key<T, U = Observable> = Extract<Exclude<keyof T, keyof U>, string>;

  /** Including but not limited to `keyof T` which are not methods or defined by base Model. */
  export type Event<T> = Key<T> | (string & {});

  /** Object comperable to data found in T. */
  export type Values<T> = { [P in Key<T>]?: Value<T[P]> };

  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill into "real" values held by exotics like ref.
   */
  export type Export<T, K extends Key<T> = Key<T>> = { [P in K]: Value<T[P]> };

  /**
   * Reference to `this` without a subscription.
   * Use to obtain full reference from a destructure.
   */
  export type Focus<T> = T & { is: T };

  /** Exotic value, actual value is contained. */
  export type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** Actual value stored in state. */
  export type Value<R> =
    R extends Ref<infer T> ? T :
    R extends Observable ? Export<R> :
    R;

  type SelectOne<T, K extends Model.Key<T>> = K;
  type SelectFew<T, K extends Model.Key<T>> = K[];

  type Exports<T, S> =
    S extends SelectOne<T, infer P> ? T[P] : 
    S extends SelectFew<T, infer P> ? Model.Export<T, P> :
    never;

  type Select<T, K extends Model.Key<T> = Model.Key<T>> = K | K[];

  type GetCallback<T, S> = (this: T, value: Exports<T, S>, updated: Model.Event<T>[]) => void;

  export interface Observable {
    get(): Export<this>;

    get(effect: Effect<this>): Callback;

    get <P extends Select<this>> (select: P): Exports<this, P>;

    get <P extends Select<this>> (select: P, callback: GetCallback<this, P>): Callback;

    /** Assert update is in progress. Returns a promise which resolves updated keys. */
    set (): Promise<Event<this>[]> | false;

    /** Detect and/or modify updates to state. */
    set (event: (key: string, value: unknown) => void | ((keys: Key<this>[]) => void)): Callback;

    set (timeout: number, test?: (key: string, value: unknown) => boolean | void): Promise<Event<this>[]>;

    set <T extends Values<this>> (from: T, append?: boolean): Promise<Event<T>[] | false>;
  }
}

interface Model extends Model.Observable {}

class Model {
  constructor(id?: string | number){
    new Control(this, id === undefined ? uid() : id);
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
  static is<T extends Model.Type>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

defineProperty(Model, "toString", {
  value(){
    return this.name;
  }
});

makeObservable(Model.prototype);

export { Model }

/* TODO: Remove below on 1.0.0 release. */

defineProperty(Model, "isTypeof", {
  get(){
    throw new Error("Model.isTypeof method was renamed. Use Model.is instead.")
  }
})

defineProperties(Model.prototype, {
  is: {
    configurable: true,
    get(){
      throw new Error("Model.is property is only available from a hook.")
    }
  }
});

/** Random alphanumberic of length 6. Will always start with a letter. */
export function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}