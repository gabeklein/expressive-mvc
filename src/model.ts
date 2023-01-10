import { Control } from './control';
import { createEffect } from './effect';
import { issues } from './issues';
import { defineProperty } from './object';
import { Subscriber } from './subscriber';

import type { Callback, Class, InstanceOf } from './types';

export const Oops = issues({
  Timeout: (keys, timeout) => 
    `No update seen for [${keys}] within ${timeout}.`,

  KeysExpected: (key) =>
    `Key "${key}" was expected in current update.`,

  StrictUpdate: () => 
    `Expected update but none in progress.`,

  StrictNoUpdate: () =>
    `Update is not expected but one is in progress!`,

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
  export type Field<T, U extends Model = Model> = Exclude<keyof T & string, keyof U>;

  /**
   * Including but not limited to `keyof T` which are not methods or defined by base Model.
   **/
  export type Event<T, U extends Model = Model> = Extends<Field<T, U>>;

  /** Object containing managed entries found in T. */
  export type Entries<T, U extends Model = Model> = { [K in Field<T, U>]: T[K] };

  /** Object comperable to data found in T. */
  export type Compat<T, U extends Model = Model> = { [K in Field<T, U>]?: T[K] };

  /** Actual value stored in state. */
  export type Value<R> = R extends Ref<infer T> ? T : R;

  /** Actual value belonging to a managed property. */
  export type ValueOf<T extends {}, K> = K extends keyof T ? Value<T[K]> : undefined;

  /**
   * Values from current state of given controller.
   * 
   * Differs from `Entries` as values here will drill into "real" values held by exotics like ref.
   */
  export type Values<T, K extends Field<T> = Field<T>> = { [P in K]: Value<T[P]> }
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

  on <P extends Model.Event<this>> (keys: P[], timeout?: number): Promise<P[]>;
  on <P extends Model.Event<this>> (keys: P[], listener: (keys: P[]) => void, once?: boolean): Callback;

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

    const single = typeof arg1 == "string";
    const keys =
      typeof arg1 == "string" ? [ arg1 ] :
      typeof arg1 == "object" ? arg1 : 
      undefined;

    if(typeof arg2 == "function" && keys)
      return Control.for(this, control => {
        for(const key of keys)
          try { void (this as any)[key] }
          catch(e){}

        const invoke: Control.OnAsync = single
          ? () => arg2.call(this, control.state.get(arg1), arg1)
          : (frame) => arg2.call(this, frame);
    
        const removeListener =
          control.addListener(key => {
            if(!key && !keys.length)
              invoke([]);
              
            if(keys.includes(key as P)){
              if(arg3)
                removeListener();

              return invoke;
            }
          });

        return removeListener;
      });

    return new Promise<any>((resolve, reject) => {
      const timeout = (message: string) => {
        const k = keys ? keys.join(", ") : "any";

        removeListener();
        reject(Oops.Timeout(k, message));
      }

      const removeListener = Control.for(this, control => {
        const pending = control.frame;

        if(keys === null){
          if(pending.size)
            reject(Oops.StrictNoUpdate())
          else
            resolve(null);

          return;
        }

        if(keys){
          if(keys.length){
            if(arg2 === 0 && single && !pending.has(keys[0])){
              reject(Oops.KeysExpected(keys[0]));
              return;
            }
            else for(const key of keys)
              try { void (this as any)[key] }
              catch(e){}
          }
        }
        else if(!pending.size && arg1 === true || arg2 === 0){
          reject(Oops.StrictUpdate());
          return;
        }
        else
          control.waiting.add(resolve);

        return control.addListener(key => {
          if(!key){
            if(keys && !keys.length)
              resolve([]);
            else
              timeout(`lifetime of ${this}`);
          }
          else if(!keys || keys.includes(key as P)){
            removeListener();
            return keys =>
              resolve(single ? control.state.get(key) : keys)
          }
        });
      })

      if(arg2 && typeof arg2 == "number")
        setTimeout(() => timeout(`${arg2}ms`), arg2);
    });
  }

  export(): Model.Values<this>;
  export <P extends Model.Field<this>> (select: Iterable<P>): Model.Values<this, P>;

  export <P extends Model.Field<this>> (subset?: Iterable<P>){
    const { state } = Control.for(this);
    const output = {} as Model.Values<this, P>;
    const keys = subset || state.keys();

    for(const key of keys)
      (output as any)[key] = state.get(key);

    return output;
  }

  update(key: Model.Event<this>): PromiseLike<readonly Model.Event<this>[]>;
  update(key: Model.Event<this>, callMethod: boolean): PromiseLike<readonly Model.Event<this>[]>;
  update<T>(key: Model.Event<this>, argument: T): PromiseLike<readonly Model.Event<this>[]>;

  update<T extends Model.Compat<this>> (source: T, select: (keyof T)[]): PromiseLike<(keyof T)[]>;
  update<T extends Model.Compat<this>> (source: T, force?: boolean): PromiseLike<(keyof T)[]>;

  update(
    arg1: Model.Event<this> | Model.Compat<this>,
    arg2?: boolean | any[]): any {

    const control = Control.for(this);

    if(typeof arg1 == "object"){
      for(const key in arg1)
        if(arg2 === true || (arg2 ? arg2.includes(key) : control.state.has(key))){
          control.state.set(key, (arg1 as any)[key]);
          control.update(key as any);
        }
    }
    else if(typeof arg1 == "string"){
      control.update(arg1 as Model.Field<this>);

      if(1 in arguments && arg1 in this){
        const method = (this as any)[arg1];

        if(typeof method == "function")
          if(typeof arg2 != "boolean")
            method.call(this, arg2);
          else if(arg2)
            method.call(this);
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