import { Control, control } from './control';
import { createEffect } from './effect';
import { define } from './helper/object';
import { use, get } from './hooks';
import { extract, update } from './observe';

import type { Callback } from '../types';

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A typeof Model, specifically one which can be created without any arguments. */
  export type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** A callback function which is subscribed to parent and updates when values change. */
  export type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | void;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  export type Key<T> = Extract<Exclude<keyof T, "set" | "get" | "null">, string>;

  /** Object comperable to data found in T. */
  export type Values<T> = { [P in Key<T>]?: Value<T[P]> };

  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill into "real" values held by exotics like ref.
   */
  export type Export<T, K extends Key<T> = Key<T>> = { [P in K]: Value<T[P]> };

  /** Exotic value, where actual value is contained within. */
  export type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** Actual value stored in state. */
  export type Value<R> =
    R extends Ref<infer T> ? T :
    R extends Model ? Export<R> :
    R;

  export type Select<T, K extends Key<T> = Key<T>> = K | K[];

  type SelectOne<T, K extends Key<T>> = K;
  type SelectFew<T, K extends Key<T>> = K[];

  export type Exports<T, S> =
    S extends SelectOne<T, infer P> ? T[P] : 
    S extends SelectFew<T, infer P> ? Export<T, P> :
    never;

  export type GetCallback<T, S> = (this: T, value: Exports<T, S>, updated: Values<T>) => void;

  export type SetCallback = (key: string) => Callback | void;

  export type Predicate = (key: string) => boolean | void;
}

class Model {
  is!: this;

  constructor(id?: string | number){
    define(this, "is", { value: this });
    new Control(this, id);
  }

  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get <P extends Model.Select<this>> (select: P): Model.Exports<this, P>;

  get <P extends Model.Select<this>> (select: P, callback: Model.GetCallback<this, P>): Callback;

  get <P extends Model.Key<this>> (
    arg1?: P | P[] | Model.Effect<this>,
    arg2?: Function){

    return typeof arg1 == "function"
      ? createEffect(this, arg1)
      : extract(this, arg1, arg2);
  }

  /** Assert update is in progress. Returns a promise which resolves updated keys. */
  set (): Promise<Model.Values<this>> | false;

  /** Detect and/or modify updates to state. */
  set (event: Model.SetCallback): Callback;

  set (timeout: number, predicate?: Model.Predicate): Promise<Model.Values<this>>;

  set (from: Model.Values<this>, append?: boolean): Promise<Model.Values<this>[] | false>;

  set(
    arg1?: number | Model.Values<this> | Model.SetCallback,
    arg2?: boolean | Model.Predicate): any {

    return typeof arg1 == "function"
      ? control(this, self => (
        self.addListener(k => k && arg1(k))
      ))
      : update(this, arg1, arg2);
    }

  /** Mark this instance for garbage collection. */
  null(){
    control(this, true).clear();
  }

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

  static use <T extends Model> (this: Model.New<T>, callback?: (instance: T) => void, repeat?: boolean): T;

  static use <T extends Model> (this: Model.New<T>, apply?: Model.Values<T>, repeat?: boolean): T;

  static use(apply: any, repeat?: boolean){
    return use(this, apply, repeat);
  }

  /** Fetch instance of this class from context. */
  static get <T extends Model> (this: Model.Type<T>, ignoreUpdates?: true): T;

  /** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
  static get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;

  static get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | Promise<R> | R>): get.NoVoid<R>;

  static get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | null>): get.NoVoid<R> | null;

  static get(this: Model.Type, argument?: boolean | get.Factory<any, any>){
    return get(this, argument);
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Type>(this: T, maybe: any): maybe is T {
    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

define(Model.prototype, "toString", {
  value(){
    return `${this.constructor}-${control(this).id}`;
  }
});

define(Model, "toString", {
  value(){
    return this.name;
  }
});

export { Model }