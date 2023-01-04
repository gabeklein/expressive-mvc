import { Control, getUpdate } from './control';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { mayRetry } from './suspense';
import { createEffect, defineProperty } from './util';

import type { Callback, Class, InstanceOf } from './types';

export const Oops = issues({
  Timeout: (keys, timeout) => 
    `No update for [${keys}] within ${timeout}.`,

  StrictUpdate: () => 
    `Strict update() did not find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Model {
  export type Type<T extends Model = Model> = typeof Model & (new () => T);

  /** Including but not limited to T. */
  type Extends<T> = T | (string & Record<never, never>);

  export { Control };
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

  on <P = Model.Event<this>> (event: (key: P) => Callback | void): Callback;

  on <P extends Model.Event<this>> (key: P): Promise<Model.ValueOf<this, P>>;
  on <P extends Model.Event<this>> (key: P, timeout: number): Promise<Model.ValueOf<this, P>>;
  on <P extends Model.Event<this>> (key: P, listener: Model.OnUpdate<this, P>, once?: boolean): Callback;

  on <P extends Model.Event<this>> (key: P[]): Promise<P[]>;
  on <P extends Model.Event<this>> (key: P[], timeout: number): Promise<P[]>;
  on <P extends Model.Event<this>> (key: P[], listener: (keys: P[]) => void, once?: boolean): Callback;

  on <P = Model.Event<this>> (keys: [], listener: Model.OnUpdate<this, P>, once?: boolean): Callback;
  on <P = Model.Event<this>> (keys: [], listener: (keys: P[]) => void, once?: boolean): Callback;

  on <P extends Model.Event<this>> (
    select: P | P[] | ((key: any) => Callback | void),
    argument?: Function | true | number,
    once?: boolean){

    if(typeof select == "function")
      return Control.for(this, x => x.addListener(select));

    const single = typeof select == "string";
    let keys = single ? [ select ] : select;

    if(typeof argument !== "function"){
      return new Promise<any>((resolve, reject) => {
        const removeListener = Control.for(this, control => {
          for(const key of keys)
            try { void (this as any)[key] }
            catch(e){}

          return control.addListener(key => {
            if(!key){
              removeListener();
              reject(Oops.Timeout(select, `lifetime of ${this}`));
            }
            else if(keys.includes(key as any)){
              removeListener();
              return () => resolve(
                single ? control.state.get(key) : getUpdate(this)
              )
            }
          });
        })

        if(typeof argument == "number")
          setTimeout(() => {
            removeListener();
            reject(Oops.Timeout(select, `${argument}ms`));
          }, argument);
      });
    }

    return Control.for(this, control => {
      if(!keys.length)
        keys = [ ...control.state.keys() ];

      for(const key of keys)
        try { void (this as any)[key] }
        catch(e){}

      const callback = single
        ? () => { argument.call(this, control.state.get(select), select) }
        : () => { argument.call(this, getUpdate(this)) }

      const onEvent = once
        ? () => {
          removeListener();
          callback();
        }
        : callback;

      const removeListener =
        control.addListener(key => {
          if(keys.includes(key as P))
            return onEvent;
        });

      return removeListener;
    });
  }

  effect(callback: Model.Effect<this>): Callback;
  effect(callback: Model.Effect<this>, select: []): Callback;
  effect(callback: Model.Effect<this>, select: Model.Event<this>[]): Callback;

  effect(callback: Model.Effect<this>, select?: Model.Event<this>[]){
    const effect = createEffect(callback);

    return Control.for(this, control => {
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

  export(): Model.Values<this>;
  export <P extends Model.Field<this>> (select: P[]): Model.Values<this, P>;

  export <P extends Model.Field<this>> (subset?: Set<P> | P[]){
    const { state } = Control.for(this);
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

  update(key: Model.Event<this>): PromiseLike<readonly Model.Event<this>[]>;
  update(key: Model.Event<this>, callMethod: boolean): PromiseLike<readonly Model.Event<this>[]>;
  update<T>(key: Model.Event<this>, argument: T): PromiseLike<readonly Model.Event<this>[]>;

  update<T extends Model.Compat<this>> (source: T, select: (keyof T)[]): PromiseLike<(keyof T)[]>;
  update<T extends Model.Compat<this>> (source: T, force?: boolean): PromiseLike<(keyof T)[]>;

  update(
    arg1?: boolean | Model.Event<this> | Model.Compat<this>,
    arg2?: boolean | any[]): any {

    const control = Control.for(this);
    const { frame, state, waiting } = control;

    if(arg1 === true && !frame.size)
      return Promise.reject(Oops.StrictUpdate());

    if(typeof arg1 == "object"){
      for(const key in arg1)
        if(arg2 === true || (arg2 ? arg2.includes(key) : state.has(key))){
          state.set(key, (arg1 as any)[key]);
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

      arg1 = undefined;
    }

    return <PromiseLike<readonly Model.Event<this>[] | false>> {
      then: (callback) => {
        if(!callback)
          throw Oops.NoChaining();

        if(frame.size || arg1 !== false)
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
    Control.for(this).clear();
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

    Control.for(instance);

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

defineProperty(Model.prototype, "toString", {
  value(){ return this.constructor.name }
})

export { Model }