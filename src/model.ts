import { CONTROL, Controller, ensure, getUpdate } from './controller';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { mayRetry } from './suspense';
import { createEffect, defineProperty, getOwnPropertyNames } from './util';

import type { Callback, Class, InstanceOf } from './types';

export const Oops = issues({
  Timeout: (keys, timeout) => 
    `No update for [${keys}] within ${timeout}.`,

  StrictUpdate: () => 
    `Strict update() did not find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");

export interface Stateful {
  /** Controller for this instance. */
  [CONTROL]?: Controller;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber;

  /** Current state of this instance. */
  [STATE]?: Model.Values<this>;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [WHY]?: readonly Model.Event<this>[];
};

declare namespace Model {
  export type Type<T extends Model = Model> = typeof Model & (new () => T);

  /** Including but not limited to T. */
  type Extends<T> = T | (string & Record<never, never>);

  export { Controller };
  export { Subscriber };

  export type OnUpdate<T, P> = (this: T, value: ValueOf<keyof T, P>, changed: P) => void;

  export type Effect<T> = (this: T, argument: T) => Callback | Promise<any> | void;

  /** Exotic value, actual value is contained. */
  export interface Ref<T = any> {
    (next: T): void;
    current: T | null;
  }

  /** Properties of T, of which are methods. */
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
  is: this;
}

class Model {
  static [WHY]: readonly string[];

  constructor(){
    defineProperty(this, CONTROL, {
      value: new Controller(this)
    });
    defineProperty(this, "is", {
      value: this
    });
  }

  get [STATE]() {
    return this.export();
  }

  get [WHY](){
    return getUpdate(this);
  }

  on <P = Model.Event<this>> (event: (key: P) => Callback | void): Callback;
  on <P = Model.Event<this>> (keys: [], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P = Model.Event<this>> (keys: [], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on (keys: [], listener: unknown, squash: boolean, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P | P[], listener: Model.OnUpdate<this, P>, squash?: boolean, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P | P[], listener: (keys: P[]) => void, squash: true, once?: boolean): Callback;
  on <P extends Model.Event<this>> (key: P | P[], listener: unknown, squash: boolean, once?: boolean): Callback;

  on <P extends Model.Event<this>> (
    select: P | P[] | ((key: any) => Callback | void),
    handler?: Function,
    squash?: boolean,
    once?: boolean){

    return ensure(this, control => {
      if(typeof select == "function")
        return control.addListener(select);

      const keys = 
        typeof select == "string" ? [ select ] :
        select.length ? select : [ ...control.state.keys() ];

      for(const key of keys)
        try { void (this as any)[key] }
        catch(e){}

      const callback = squash
        ? () => {
          handler!.call(this, getUpdate(this))
        }
        : () => {
          getUpdate(this)
            .filter(k => keys.includes(k as any))
            .forEach(k => {
              handler!.call(this, control.state.get(k), k)
            })
        }

      const onEvent = once
        ? () => {
          remove();
          callback();
        }
        : callback;

      const remove = control.addListener(key => {
        if(keys.includes(key as any))
          return onEvent;
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
  once <P extends Model.Event<this>> (key: P | P[], timeout?: number): Promise<void>;

  once <P extends Model.Event<this>> (
    select: P | P[],
    argument?: Model.OnUpdate<any, any> | number,
    squash?: boolean){

    if(typeof argument == "function")
      return this.on(select, argument, squash, true);

    if(typeof select == "string")
      select = [ select ];

    return new Promise<void>((resolve, reject) => {
      const invoke = (key?: string | null) => {
        if(!key){
          clear();
          reject(
            Oops.Timeout(select,
              typeof argument == "number"
                ? `${argument}ms`
                : `lifetime of ${this}`
            )
          );
        }
        else if((select as string[]).includes(key)){
          clear();
          return resolve;
        }
      }

      const clear = ensure(this, x => {
        for(const key of select)
          try { void (this as any)[key] }
          catch(e){}

        return x.addListener(invoke);
      })

      if(typeof argument == "number")
        setTimeout(invoke, argument);
    });
  }

  effect(callback: Model.Effect<this>): Callback;
  effect(callback: Model.Effect<this>, select: []): Callback;
  effect(callback: Model.Effect<this>, select: Model.Event<this>[]): Callback;

  effect(callback: Model.Effect<this>, select?: Model.Event<this>[]){
    const effect = createEffect(callback);

    return ensure(this, control => {
      let busy = false;
      let inject = this.is;

      const invoke = () => {
        if(busy)
          return;

        const output = mayRetry(() => {
          effect.call(inject, inject);
        })

        if(output instanceof Promise){
          output.finally(() => busy = false);
          busy = true;
        }
      }

      if(!select){
        const sub = control.subscribe(() => invoke);

        inject = sub.proxy;
        invoke();

        return sub.commit();
      }

      invoke();

      return control.addListener(key => {
        if(key === null){
          if(!select.length)
            invoke();
        }
        else if(select.includes(key))
          return invoke;
      });
    })
  }

  // TODO: account for exotic properties
  import <O extends Model.Compat<this>> (source: O, select?: (keyof O)[]){
    const { subject } = ensure(this);

    if(!select)
      select = getOwnPropertyNames(subject) as (keyof O)[];

    for(const key of select)
      if(key in source)
        (this as any)[key] = source[key];
  }

  export(): Model.Values<this>;
  export <P extends Model.Field<this>> (select: P[]): Model.Values<this, P>;

  export <P extends Model.Field<this>> (subset?: Set<P> | P[]){
    const { state } = ensure(this);
    const output = {} as Model.Values<this, P>;
    const keys = subset || state.keys();

    for(const key of keys)
      (output as any)[key] = state.get(key);

    return output;
  }

  update(): PromiseLike<readonly Model.Event<this>[] | false>;
  update(strict: true): Promise<readonly Model.Event<this>[]>;
  update(strict: false): Promise<false>;
  update(strict: boolean): Promise<readonly Model.Event<this>[] | false>;
  update(keys: Model.Event<this>): PromiseLike<readonly Model.Event<this>[]>;
  update(keys: Model.Event<this>, callMethod: boolean): PromiseLike<readonly Model.Event<this>[]>;
  update<T>(keys: Model.Event<this>, argument: T): PromiseLike<readonly Model.Event<this>[]>;

  update(arg?: any, tag?: any): any {
    const target = ensure(this);
    const { frame, waiting } = target;

    if(typeof arg == "string"){
      target.update(arg as Model.Field<this>);

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

    if(!frame.size && arg === true)
      return Promise.reject(Oops.StrictUpdate());

    return <PromiseLike<readonly Model.Event<this>[] | false>> {
      then: (callback) => {
        if(!callback)
          throw Oops.NoChaining();

        if(frame.size || arg !== false)
          waiting.add(() => {
            callback(getUpdate(this));
          });
        else
          callback(false);
      }
    }
  }

  /** 
   * Mark this instance for garbage-collection and send `willDestroy` event to all listeners.
   */
  destroy(){
    ensure(this).clear();
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
    this: T, ...args: ConstructorParameters<T>): InstanceOf<T> {

    const instance = new this(...args);

    ensure(instance);

    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * 
   * Will determine if provided class is a subtype of this one. 
   */
  static isTypeof<T extends new () => Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

export { Model }