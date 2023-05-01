import { Control, control, controls } from './control';
import { Debug } from './debug';
import { createEffect } from './effect';
import { addEventListener, awaitUpdate } from './event';
import { issues } from './helper/issues';
import { defineProperty } from './helper/object';

import type { Callback, Class, Extends, InstanceOf, NoVoid } from '../types';

export const Oops = issues({
  NoAdapter: (method) =>
    `Can't call Model.${method} without an adapter.`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}.`
});

declare namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = abstract new () => T;

  // TODO: Can this be combined with Type?
  export type Class<T extends Model> = (abstract new () => T) & typeof Model;

  /** A typeof Model, specifically one which can be created without any arguments. */
  export type New<T extends Model = Model> = (new () => T) & typeof Model;

  export type Effect<T> = (this: T, argument: T) => Callback | Promise<any> | void;

  /** Exotic value, actual value is contained. */
  export type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** Properties of T which are methods. */
  export type Methods<T> = {
    [K in keyof T]:
      T[K] extends Ref ? never :
      T[K] extends Function ? K :
      never;
  }[keyof T];

  type BuiltIn = keyof Model | keyof Debug<Model>;

  /**
   * Subset of `keyof T` which are not methods or defined by base Model U.
   * 
   * **Note**: This excludes all keys which are not of type `string` (only those are managed).
   * 
   * TODO: Should exclude methods
   **/
  export type Key<T> = Exclude<keyof T, BuiltIn> & string;

  /**
   * Including but not limited to `keyof T` which are not methods or defined by base Model.
   * 
   * TODO: Should this be supported?
   **/
  export type Event<T> = Extends<Key<T>>;

  /** Object containing managed entries found in T. */
  export type Entries<T> = { [K in Key<T>]: T[K] };

  /** Object comperable to data found in T. */
  export type Compat<T> = { [K in Key<T>]?: T[K] };

  /** Actual value stored in state. */
  export type Value<R> = R extends Ref<infer T> ? T : R;

  /** Actual value belonging to a managed property. */
  export type ValueOf<T extends {}, K> = K extends keyof T ? Value<T[K]> : undefined;

  /**
   * Values from current state of given controller.
   * 
   * Differs from `Entries` as values here will drill into "real" values held by exotics like ref.
   */
  export type Get<T, K extends Key<T> = Key<T>> = { [P in K]: Value<T[P]> };

  export type Export<T> = { [P in Key<T>]: Value<T[P]> };

  export type GetCallback<T extends Model, R> =
    (this: T, model: T, update: ForceUpdate) => R;

  type ForceUpdate = {
    /** Force an update in current component. */
    (): void;
    
    /**
     * Force an update and again after promise either resolves or rejects.
     * Will return a duplicate of given Promise, which resolves after refresh.
     */
    <T = void>(passthru: Promise<T>): Promise<T>

    /**
     * Force a update while calling async function.
     * A refresh will occur both before and after given function.
     * Any actions performed before first `await` will occur before refresh!
     */
    <T = void>(invoke: () => Promise<T>): Promise<T>
  };

  export type Suspense = Promise<void> & Error;

  export type OnCallback<T extends Model> =
    (this: T, keys: Model.Event<T>[] | null | false) => void;
}

class Model {
  constructor(id?: string | number){
    new Control(this, id);
  }

  /**
   * Reference to `this` without a subscription.
   * Use to obtain full reference from a destructure.
   */
  get is(){
    return this;
  }

  on (): Promise<Model.Event<this>[]>;
  on (timeout?: number): Promise<Model.Event<this>[] | false>;

  on <P extends Model.Event<this>> (keys?: P | Iterable<P>, timeout?: number): Promise<P[] | false>;
  on <P extends Model.Event<this>> (keys: P | Iterable<P>, listener: Model.OnCallback<this>, once?: boolean): Callback;

  on (effect: Model.Effect<this>): Callback;

  on <P extends Model.Event<this>> (
    arg1?: number | P[] | P | Model.Effect<this>,
    arg2?: number | Model.OnCallback<this>,
    arg3?: boolean){

    if(typeof arg1 == "function")
      return createEffect(this, arg1);

    if(typeof arg1 == "number"){
      arg2 = arg1;
      arg1 = undefined;
    }

    return typeof arg2 == "function"
      ? addEventListener(this, arg1, arg2, arg3)
      : awaitUpdate(this, arg1, arg2);
  }

  get(): Model.Export<this>;

  get <P extends Model.Key<this>> (select: P): this[P];
  get <P extends Model.Key<this>> (select: P, listener: (this: this, value: this[P], changed: P[]) => void): Callback;

  get <P extends Model.Key<this>> (select: Iterable<P>): Model.Get<this, P>;
  get <P extends Model.Key<this>> (select: Iterable<P>, listener: (this: this, value: Model.Get<this, P>, changed: P[]) => void): Callback;
  
  get <P extends Model.Key<this>> (
    arg1?: P | Iterable<P>,
    arg2?: Function){

    const { state } = control(this);

    function values(){
      if(typeof arg1 == "string")
        return state[arg1];

      if(!arg1)
        return { ...state };
  
      const output = {} as any;
  
      for(const key of arg1)
        output[key] = state[key];
  
      return output;
    }

    return typeof arg2 == "function"
      ? this.on(arg1!, () => arg2(values()))
      : values();
  }

  set(key: Model.Event<this>): PromiseLike<readonly Model.Event<this>[]>;
  set<K extends Model.Event<this>>(key: Model.Event<this>, value: Model.ValueOf<this, K>): PromiseLike<readonly Model.Event<this>[]>;

  set<T extends Model.Compat<this>> (source: T, select: (keyof T)[]): PromiseLike<(keyof T)[]>;
  set<T extends Model.Compat<this>> (source: T, force?: boolean): PromiseLike<(keyof T)[]>;

  set(
    arg1: Model.Event<this> | Model.Compat<this>,
    arg2?: boolean | any[]): any {

    const controller = control(this);
    const { state } = controller;

    if(typeof arg1 == "object"){
      for(const key in arg1)
        if(arg2 === true || (arg2 ? arg2.includes(key) : key in state)){
          state[key] = (arg1 as any)[key];
          controller.update(key);
        }
    }
    else if(typeof arg1 == "string"){
      controller.update(arg1);

      if(1 in arguments){
        if(arg1 in state)
          state[arg1] = arg2;

        else if(arg1 in this){
          const method = (this as any)[arg1];

          if(typeof method == "function")
            method.call(this, arg2);
        }
      }
    }

    return awaitUpdate(this, undefined, 0);
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
  static new<T extends Class>(
    this: T, ...args: ConstructorParameters<T>): InstanceOf<T> {

    const instance = new this(...args);
    control(instance);
    return instance;
  }

  static has <T extends Model> (this: Model.Type<T>, required?: boolean, relativeTo?: Model): (callback: (got: T) => void) => void;
  static has <T extends Model> (this: Model.Type<T>, required?: false, relativeTo?: Model): (callback: (got: T | undefined) => void) => void;

  static has(required?: false, relativeTo?: Model): any {
    if(!relativeTo)
      throw Oops.NoAdapter("has");

    if(required)
      throw Oops.Required(this, relativeTo.constructor);
  }

  static get <T extends Model> (this: Model.Type<T>): T;

  /** Fetch instance of this class in passive mode. Will not subscribe to events. */
  static get<T extends Model>(this: Model.Type<T>, ignoreUpdates: true): T;

  /** Fetch instance of this class optionally. May be undefined. */
  static get<T extends Model>(this: Model.Type<T>, required: false): T | undefined;

  static get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, R | (() => R)>, expect?: boolean): R;
  static get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, Promise<R> | (() => R) | null>, expect?: boolean): R | null;
  static get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;

  static get <T extends Model, R> (this: Model.Type<T>, init: Model.GetCallback<T, () => R>): NoVoid<R>;
  static get <T extends Model, R> (this: Model.Type<T>, init: Model.GetCallback<T, (() => R) | null>): NoVoid<R> | null;

  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, R>, expect?: boolean): NoVoid<R>;

  static get(): never {
    throw Oops.NoAdapter("get");
  }

  static use <I extends Model> (this: Model.Type<I>, watch: Model.Key<I>[], callback?: (instance: I) => void): I;
  static use <I extends Model> (this: Model.Type<I>, callback?: (instance: I) => void): I;
  static use <I extends Model> (this: Model.Type<I>, apply: Model.Compat<I>, keys?: Model.Event<I>[]): I;

  static use(){
    throw Oops.NoAdapter("use");
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

defineProperty(Model.prototype, "toString", {
  configurable: true,
  value(){
    return `${this.constructor.name}-${controls(this).id}`;
  }
})

defineProperty(Model, "toString", {
  value(){
    return this.name;
  }
})

export { Model }