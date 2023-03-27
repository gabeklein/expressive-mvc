import { Control, control } from './control';
import { Debug } from './debug';
import { createEffect } from './effect';
import { addEventListener, awaitUpdate } from './event';
import { issues } from './helper/issues';
import { defineProperty } from './helper/object';
import { Subscriber } from './subscriber';

import type { Callback, Class, InstanceOf, MaybePromise, NoVoid } from './helper/types';

export const Oops = issues({
  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`,

  NoAdapter: (method) => `Can't call Model.${method} without an adapter.`
});

declare namespace Model {
  export { Control };
  export { Subscriber };

  /** Including but not limited to T. */
  type Extends<T> = T | (string & Record<never, never>);

  /** Any typeof Model, using class constructor as the reference. */
  export type Type<T extends Model = Model> = (abstract new (...args: any[]) => T);

  // TODO: Can this be combined with Type?
  export type Class<T extends Model> = Type<T> & typeof Model;

  /** A typeof Model, specifically one which may be created without arguments. */
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

  export type FindFunction = <T extends Model>(
    type: Model.Type<T>,
    relativeTo: Model,
    required: boolean
  ) => (_refresh: (x: T) => void) => T | undefined;

  export type TapCallback<T extends Model, R> =
    (this: T, model: T, update: ForceUpdate) => R;

  type ForceUpdate = {
    /** Force an update in current component. */
    (): void;
    
    /**
     * Force an update and again after promise either resolves or rejects.
     * Will return a duplicate of given Promise, which resolves after refresh.
     */
    <T = void>(passthru?: Promise<T>): Promise<T>

    /**
     * Force a update while calling async function.
     * A refresh will occur both before and after given function.
     * Any actions performed before first `await` will occur before refresh!
     */
    <T = void>(invoke?: () => Promise<T>): Promise<T>
  };

  export type Suspense = Promise<void> & Error;
}

class Model {
  /**
   * Reference to `this` without a subscription.
   * Use to obtain full reference from a destructure.
   */
  is!: this;

  constructor(){
    new Control(this);
    defineProperty(this, "is", { value: this });
  }

  on <P extends Model.Event<this>> (keys?: P | Iterable<P>, timeout?: number): Promise<P[]>;
  on <P extends Model.Event<this>> (keys: P | Iterable<P>, listener: (this: this, keys: Model.Event<this>[]) => void, once?: boolean): Callback;

  on (effect: Model.Effect<this>): Callback;
  on (effect: Model.Effect<this>, watch?: []): Callback;
  on (effect: Model.Effect<this>, watch?: Model.Event<this>[]): Callback;

  on (key?: undefined, timeout?: number): Promise<Model.Event<this>[]>;

  on (current?: boolean): Promise<Model.Event<this>[] | null>;
  on (current: true): Promise<Model.Event<this>[]>;
  on (current: null): Promise<null>;

  on <P extends Model.Event<this>> (
    arg1?: boolean | null | P | P[] | Model.Effect<this>,
    arg2?: number | P[] | ((this: this, keys: Model.Event<this>[]) => void),
    arg3?: boolean){

    if(typeof arg1 == "function")
      return createEffect(this.is, arg1, arg2 as P[]);

    if(typeof arg2 != "function")
      return awaitUpdate(this.is, arg1, arg2 as number);

    if(arg1)
      return addEventListener(this.is, arg1 as P | P[], arg2, arg3);
  }

  get(): Model.Export<this>;

  get <P extends Model.Key<this>> (select: P): this[P];
  get <P extends Model.Key<this>> (select: Iterable<P>): Model.Get<this, P>;

  get <P extends Model.Key<this>> (select: P, timeout: number): Promise<this[P]>;
  get <P extends Model.Key<this>> (select: Iterable<P>, timeout: number): Promise<Model.Get<this, P>>;

  get <P extends Model.Key<this>> (select: P, onChange: true): Promise<this[P]>;
  get <P extends Model.Key<this>> (select: Iterable<P>, onChange: true): Promise<Model.Get<this, P>>;

  get <P extends Model.Key<this>> (select: P, onChange: boolean): MaybePromise<this[P]>;
  get <P extends Model.Key<this>> (select: Iterable<P>, onChange: boolean): MaybePromise<Model.Get<this, P>>;

  get <P extends Model.Key<this>> (select: P, listener: (this: this, value: this[P], key: P[]) => void): Callback;
  get <P extends Model.Key<this>> (select: Iterable<P>, listener: (this: this, value: Model.Get<this, P>, key: P[]) => void): Callback;
  
  get <P extends Model.Key<this>> (
    arg1?: P | Iterable<P>,
    arg2?: Function | boolean | number){

    const { state } = control(this);
    const extract = () => {
      if(typeof arg1 == "string")
        return state.get(arg1);
      
      const output = {} as any;

      for(const key of arg1 || state.keys())
        output[key] = state.get(key);

      return output as Model.Get<this, P>;
    }

    if(!arg1 || arg2 === undefined)
      return extract();

    if(typeof arg2 == "function")
      return this.on(arg1, () => arg2(extract()));

    const timeout = typeof arg2 == "number" ? arg2 : undefined;

    return this.on(arg1, timeout).then(extract);
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

    if(typeof arg1 == "string"){
      controller.update(arg1 as Model.Key<this>);

      if(1 in arguments){
        if(state.has(arg1))
          state.set(arg1, arg2);

        else if(arg1 in this){
          const method = (this as any)[arg1];

          if(typeof method == "function")
            method.call(this, arg2);
        }
      }
    }
    else if(typeof arg1 == "object")
      for(const key in arg1)
        if(arg2 === true || (arg2 ? arg2.includes(key) : state.has(key))){
          state.set(key, (arg1 as any)[key]);
          controller.update(key as any);
        }

    return <PromiseLike<readonly Model.Event<this>[] | null>> {
      then: (callback) => {
        if(!callback)
          throw Oops.NoChaining();

        controller.waiting.add(callback);
      }
    }
  }

  /** Mark this instance for garbage collection. */
  gc(){
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

  static find <T extends Model> (this: Model.Type<T>, required?: boolean): T;
  static find <T extends Model> (this: Model.Type<T>, required: false): T | undefined;

  static find(){
    throw Oops.NoAdapter("find");
  }

  static get <T extends Model> (this: Model.Type<T>): T;
  static get <T extends Model> (this: Model.Type<T>, passive: true): T
  static get <T extends Model> (this: Model.Type<T>, required: false): T | undefined;
  static get <T extends Model, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: Model.TapCallback<T, R | (() => R)>, expect?: boolean): R;
  static get <T extends Model, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R> | (() => R) | null>, expect?: boolean): R | null;
  static get <T extends Model, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
  static get <T extends Model, R> (this: Model.Type<T>, init: Model.TapCallback<T, () => R>): NoVoid<R>;
  static get <T extends Model, R> (this: Model.Type<T>, init: Model.TapCallback<T, (() => R) | null>): NoVoid<R> | null;
  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
  static get <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

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
  value(){
    return this.constructor.name;
  }
})

export { Model }