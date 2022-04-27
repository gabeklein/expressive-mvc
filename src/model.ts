import * as Computed from './compute';
import { control, Controller } from './controller';
import { UPDATE } from './dispatch';
import { Subscriber } from './subscriber';
import { BunchOf, Callback, Class, InstanceOf, RequestCallback } from './types';
import { createEffect, define, defineLazy, getOwnPropertyNames } from './util';

export const CONTROL = Symbol("CONTROL");
export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");

export interface Stateful {
  /** Controller for this instance. */
  [CONTROL]: Controller;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber;

  /** Current state of this instance. */
  [STATE]?: this;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [WHY]?: readonly string[];
};

declare namespace Model {
  type IfApplicable<T extends {}, K> = K extends keyof T ? T[K] : undefined;

  /** Including but not limited to T. */
  type Extends<T> = T | (string & Record<never, never>);

  export { Controller };
  export { Subscriber };

  export type OnUpdate<T, P> = (this: T, value: IfApplicable<keyof T, P>, changed: P) => void;

  export type Effect<T> = (this: T, argument: T) => Callback | Promise<any> | void;

  /** Exotic value, actual value is contained. */
  export interface Ref<T = any> {
      (next: T): void;
      current: T | null;
  }

  /** Properties of T, only which are methods. */
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
   **/
  // TODO: Should exclude methods
  export type Field<T, U extends Model = Model> = Exclude<keyof T & string, keyof U>;

  /**
   * Including but not limited to `keyof T` which are not methods or defined by base Model.
   **/
  export type Event<T, U extends Model = Model> = Extends<Field<T, U>>;

  /** Object containing managed entries found in T. */
  export type Entries<T, U extends Model = Model> = Pick<T, Field<T, U>>;

  /** Object comperable to data found in T. */
  export type Compat<T, U extends Model = Model> = Partial<Entries<T, U>>;

  /** Actual value stored in state. */
  export type Value<R> = R extends Ref<infer T> ? T : R;

  /**
   * Values from current state of given controller.
   * 
   * Differs from `Entries` as values here will drill into "real" values held by exotics like ref.
   */
  export type Values<T, K extends Field<T, Model> = Field<T, Model>> = {
    [P in K]: Value<T[P]>;
  }
}

interface Model extends Stateful {
  /**
   * Circular reference to `this` controller.
   * 
   * Useful to obtain full reference where one has already destructured.
   */
  get: this;

  /**
  * Circular reference to `this` controller.
  * 
  * Shortcut is mainly to update values, while having destructured already.
  */
  set: this;
}

class Model {
  static [CONTROL]: Controller;
  static [WHY]: readonly string[];

  constructor(){
    define(this, CONTROL, new Controller(this));
    define(this, "get", this);
    define(this, "set", this);
  }

  get [STATE]() {
    return this[CONTROL].state as this;
  }

  get [WHY](){
    return UPDATE.get(this);
  }

  on <P = Model.Event<this>> (keys: [], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P = Model.Event<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;

  on <P extends Model.Event<this>> (key: P | P[], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

  on <P extends Model.Event<this>> (
    select: P | P[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    return control(this, control => {
      const keys = 
        typeof select == "string" ? [select] :
        !select.length ? getOwnPropertyNames(control.state) :
        select;

      Computed.ensure(control, keys);

      const callback: RequestCallback = squash
        ? handler.bind(this)
        : frame => frame
          .filter(k => keys.includes(k))
          .forEach(k => handler.call(this, control.state[k], k))

      const trigger: RequestCallback = once
        ? frame => { remove(); callback(frame) }
        : callback;

      const remove = control.addListener(key => {
        if(keys.includes(key))
          return trigger;
      });

      return remove;
    });
  }

  once <P = Model.Event<this>> (keys: [], listener: Model.OnUpdate<this, P>, squash?: false, once?: boolean): Callback;
  once <P = Model.Event<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  once <P = Model.Event<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  once (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;

  once <P extends Model.Event<this>> (key: P | P[], listener: Model.OnUpdate<this, P>, squash?: false): Callback;
  once <P extends Model.Event<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true): Callback;
  once <P extends Model.Event<this>> (key: P | P[], listener: unknown, squash: boolean): Callback;
  once <P extends Model.Event<this>> (key: P | P[]): Promise<P[]>;

  once <P extends Model.Event<this>> (
    select: P | P[],
    callback?: Model.OnUpdate<any, any>,
    squash?: boolean){

    if(callback)
      return this.on(select, callback, squash, true);

    return new Promise<P[]>(resolve => {
      this.on(select, resolve, true, true);
    });
  }

  effect(callback: Model.Effect<this>): Callback;
  effect(callback: Model.Effect<this>, select: []): Callback;
  effect(callback: Model.Effect<this>, select: (keyof this)[]): Callback;
  effect(callback: Model.Effect<this>, select?: (keyof this)[]){
    const effect = createEffect(callback);

    return control(this, control => {
      if(!select){
        const sub = new Subscriber(control, () => invoke);
        const invoke = () => {
          const x = sub.proxy;
          effect.call(x, x);
        }

        invoke();

        return sub.commit();
      }

      const invoke = () => {
        effect.call(this.get, this.get);
      }

      invoke();

      if(!select.length){
        control.onDestroy.add(invoke);
        return () => {
          control.onDestroy.delete(invoke);
        }
      }

      return control.addListener(key => {
        if(select.includes(key as keyof this))
          return invoke;
      });
    })
  }

  import <O extends Model.Compat<this>> (source: O, select?: (keyof O)[]){
    if(!select)
      select = getOwnPropertyNames(this) as (keyof O)[];

    for(const key of select)
      if(key in source)
        (this as any)[key] = source[key];
  }

  export(): Model.Values<this>;
  export <P extends Model.Field<this>> (select: P[]): Model.Values<this, P>;

  export(subset?: Set<string> | string[]){
    const { state } = control(this);
    const output: BunchOf<any> = {};

    for(const key of subset || getOwnPropertyNames(state))
      output[key] = (state as any)[key];

    return output;
  }

  update(): PromiseLike<readonly string[] | false>;
  update(strict: true): Promise<readonly string[]>;
  update(strict: false): Promise<false>;
  update(strict: boolean): Promise<readonly string[] | false>;

  update(keys: Model.Event<this>): PromiseLike<readonly string[]>;
  update(keys: Model.Event<this>, callMethod: boolean): PromiseLike<readonly string[]>;
  update<T>(keys: Model.Event<this>, argument: T): PromiseLike<readonly string[]>;

  update(arg?: any, tag?: any): any {
    const target = control(this);

    if(typeof arg == "string"){
      target.update(arg);

      if(1 in arguments && arg in this){
        const method = (this as any)[arg];

        if(typeof method == "function")
          if(typeof tag != "boolean")
            method.call(this, tag);
          else if(tag)
            method.call(this);
      }

      arg = undefined;
    }

    return target.requestUpdate(arg);
  }

  /** 
   * Mark this instance for garbage-collection and send `willDestroy` event to all listeners.
   */
  destroy(){
    control(this).stop();
  }

  toString(){
    return this.constructor.name;
  }

  /**
   * Creates a new instance of this controller.
   * 
   * Beyond `new this(...)`, method will activate managed-state.
   * 
   * @param args - arguments sent to constructor
   */
  static create<T extends Class>(
    this: T, ...args: any[]): InstanceOf<T> {

    const instance = 
      new (this as any)(...args);

    control(instance);

    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * 
   * Will determine if provided class is a subtype of this one. 
   */
  static isTypeof<T extends typeof Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

export { Model }

defineLazy(Model, CONTROL, function(){
  return new Controller(this);
})