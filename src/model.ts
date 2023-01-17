import { Control } from './control';
import { Debug } from './debug';
import { createEffect } from './effect';
import { addEventListener, awaitUpdate } from './event';
import { issues } from './helper/issues';
import { defineProperty } from './helper/object';
import { Subscriber } from './subscriber';

import type { Callback, Class, InstanceOf } from './helper/types';

export const Oops = issues({
  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Model {
  export { Control };
  export { Subscriber };

  /** Including but not limited to T. */
  type Extends<T> = T | (string & Record<never, never>);

  export type Type<T extends Model = Model> = typeof Model & (new () => T);

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

  /**
   * Subset of `keyof T` which are not methods or defined by base Model U.
   * 
   * **Note**: This excludes all keys which are not of type `string` (only those are managed).
   * 
   * TODO: Should exclude methods
   **/
  export type Field<T, E extends Model = Model> = Exclude<keyof T, keyof E | keyof Debug<{}>> & string;

  /**
   * Including but not limited to `keyof T` which are not methods or defined by base Model.
   **/
  export type Event<T, E extends Model = Model> = Extends<Field<T, E>>;

  /** Object containing managed entries found in T. */
  export type Entries<T, E extends Model = Model> = { [K in Field<T, E>]: T[K] };

  /** Object comperable to data found in T. */
  export type Compat<T, E extends Model = Model> = { [K in Field<T, E>]?: T[K] };

  /** Actual value stored in state. */
  export type Value<R> = R extends Ref<infer T> ? T : R;

  /** Actual value belonging to a managed property. */
  export type ValueOf<T extends {}, K> = K extends keyof T ? Value<T[K]> : undefined;

  /**
   * Values from current state of given controller.
   * 
   * Differs from `Entries` as values here will drill into "real" values held by exotics like ref.
   */
  export type Get<T, K extends Field<T> = Field<T>> = { [P in K]: Value<T[P]> };

  export type Export<T, E extends Model = Model> = { [P in Field<T, E>]: Value<T[P]> };
}

class Model {
  /**
   * Circular reference to `this` controller.
   * 
   * Useful to obtain full reference where one has already destructured.
   */
  is!: this;

  constructor(){
    new Control(this);
    defineProperty(this, "is", { value: this });
  }

  on <P extends Model.Event<this>> (key: P, timeout?: number): Promise<Model.ValueOf<this, P>>;
  on <P extends Model.Field<this>> (key: P, listener: (this: this, value: this[P], key: P) => void, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P, listener: (this: this, value: undefined, key: P) => void, once?: boolean): Callback;

  on <P extends Model.Event<this>> (keys: Iterable<P>, timeout?: number): Promise<P[]>;
  on <P extends Model.Event<this>> (keys: Iterable<P>, listener: (keys: P[]) => void, once?: boolean): Callback;

  on (effect: Model.Effect<this>): Callback;
  on (effect: Model.Effect<this>, watch?: []): Callback;
  on (effect: Model.Effect<this>, watch?: Model.Event<this>[]): Callback;

  on (key?: undefined, timeout?: number): Promise<Model.Event<this>[]>;

  on (current?: boolean): Promise<Model.Event<this>[] | null>;
  on (current: true): Promise<Model.Event<this>[]>;
  on (current: null): Promise<null>;

  on <P extends Model.Event<this>> (
    arg1?: boolean | null | P | P[] | Model.Effect<this>,
    arg2?: number | P[] | Function,
    arg3?: boolean){

    if(typeof arg1 == "function")
      return createEffect(this.is, arg1, arg2 as P[]);

    if(typeof arg2 != "function")
      return awaitUpdate(this, arg1, arg2 as number);

    if(arg1)
      return addEventListener(this.is, arg1 as P | P[], arg2, arg3);
  }

  get(): Model.Export<this>;

  get <P extends Model.Field<this>> (property: P): this[P];
  get <P extends Model.Field<this>> (property: P, timeout: number): Promise<this[P]>;
  get <P extends Model.Field<this>> (property: P, onChange: true): Promise<this[P]>;
  get <P extends Model.Field<this>> (property: P, onChange: boolean): this[P] | Promise<this[P]>;
  get <P extends Model.Field<this>> (property: P, listener: (this: this, value: this[P], key: P[]) => void): Callback;

  get <P extends Model.Field<this>> (select: Iterable<P>): Model.Get<this, P>;
  get <P extends Model.Field<this>> (select: Iterable<P>, timeout: number): Promise<Model.Get<this, P>>;
  get <P extends Model.Field<this>> (select: Iterable<P>, onChange: true): Promise<Model.Get<this, P>>;
  get <P extends Model.Field<this>> (select: Iterable<P>, onChange: boolean): Model.Get<this, P> | Promise<Model.Get<this, P>>;
  get <P extends Model.Field<this>> (select: Iterable<P>, listener: (this: this, value: Model.Get<this, P>, key: P[]) => void): Callback;
  
  get <P extends Model.Field<this>> (
    arg1?: Iterable<P> | P,
    arg2?: Function | boolean | number){

    const { state } = Control.for(this);
    const extract = typeof arg1 == "string"
      ? () => state.get(arg1)
      : () => {
        const output = {} as any;

        for(const key of arg1 || state.keys())
          output[key] = state.get(key);

        return output as Model.Get<this, P>;
      }

    if(!arg1 || arg2 === undefined)
      return extract();

    if(typeof arg2 == "function")
      return this.on(arg1, () => arg2(extract()));

    const timeout =
      typeof arg2 == "number" ? arg2 : undefined;
      
    return this.on(arg1, timeout).then(extract);
  }

  set(key: Model.Event<this>): PromiseLike<readonly Model.Event<this>[]>;
  set<K extends Model.Event<this>>(key: Model.Event<this>, value: Model.ValueOf<this, K>): PromiseLike<readonly Model.Event<this>[]>;

  set<T extends Model.Compat<this>> (source: T, select: (keyof T)[]): PromiseLike<(keyof T)[]>;
  set<T extends Model.Compat<this>> (source: T, force?: boolean): PromiseLike<(keyof T)[]>;

  set(
    arg1: Model.Event<this> | Model.Compat<this>,
    arg2?: boolean | any[]): any {

    const control = Control.for(this);

    if(typeof arg1 == "object")
      for(const key in arg1){
        if(arg2 === true || (arg2 ? arg2.includes(key) : control.state.has(key))){
          control.state.set(key, (arg1 as any)[key]);
          control.update(key as any);
        }
      }

    else if(typeof arg1 == "string"){
      control.update(arg1 as Model.Field<this>);

      if(1 in arguments){
        if(control.state.has(arg1))
          control.state.set(arg1, arg2);

        else if(arg1 in this){
          const method = (this as any)[arg1];

          if(typeof method == "function")
            method.call(this, arg2);
        }
      }
    }

    return <PromiseLike<readonly Model.Event<this>[] | null>> {
      then: (callback) => {
        if(!callback)
          throw Oops.NoChaining();

        control.waiting.add(callback);
      }
    }
  }

  /** 
   * Clean up side effects and mark this instance for garbage-collection.
   */
  destroy(){
    Control.for(this).clear();
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
    Control.for(instance);
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

defineProperty(Model.prototype, "toString", {
  value(){
    return this.constructor.name;
  }
})

export { Model }