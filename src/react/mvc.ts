import React from 'react';

import { issues } from '../helper/issues';
import { Callback, Class, InstanceOf, NoVoid } from '../helper/types';
import { Model } from '../model';
import { useContext } from './context';
import { useNew } from './useNew';
import { useSubscribe } from './useTap';
import { useCompute } from './useCompute';

export const Global = new WeakMap<Class, MVC>();

export const Oops = issues({
  DoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.new() before attempting to access, or consider using ${name}.use() instead.`,

  AlreadyExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`
})

declare namespace MVC {
  type EffectCallback<T = MVC> = (found: T) => Callback | void;

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

  type TapCallback<T extends Model, R> =
    (this: T, model: T, update: MVC.ForceUpdate) => R;
}

class MVC extends Model {
  end(force?: boolean): boolean | void {
    const type = this.constructor as typeof MVC;
    
    if(type.keepAlive && !force)
      return false;

    super.end();
    Global.delete(type);

    return true;
  }

  static global?: boolean;
  static keepAlive?: boolean;

  /**
   * Create a new instance of this model and activate its managed state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends Class> (this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;

  static new(...args: []){
    if(Global.has(this))
      if(this.keepAlive)
        return Global.get(this);
      else
        throw Oops.AlreadyExists(this.name);

    const instance = super.new(...args) as MVC;

    if(this.global)
      Global.set(this, instance);

    return instance;
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends MVC> (this: Model.Type<T>, required?: boolean, effectCallback?: MVC.EffectCallback<T>): T;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends MVC> (this: Model.Type<T>, required: false, effectCallback?: MVC.EffectCallback<T | undefined>): T | undefined;

  /**
   * **React Hook** - Fetch instance.
   * 
   * Effect callback will run once if found, throw if not found.
   * Returned function is called on unmount.
   */
  static get <I extends MVC> (this: Model.Type<I>, effectCallback: MVC.EffectCallback<I>): I | undefined;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <I extends MVC, K extends Model.Key<I>> (this: Model.Type<I>, key: K): I[K];

  static get(
    arg1?: string | boolean | MVC.EffectCallback,
    arg2?: MVC.EffectCallback<MVC | undefined>){

    let instance: MVC | undefined;
    const required = arg1 === undefined || arg1 === true;

    if(this.global){
      instance = Global.get(this);

      if(!instance && required)
        throw Oops.DoesNotExist(this.name);
    }
    else
      instance = useContext(this, required);

    function callback(effect: MVC.EffectCallback<any>){
      try {
        React.useLayoutEffect(() => effect(instance!), []);
      }
      catch(err){
        if(instance)
          instance.on(effect, []);
        else
          effect(undefined);
      }
    }

    if(typeof arg1 === "string")
      return (instance as any)[arg1];

    if(typeof arg1 === "function" && instance)
      callback(arg1);
    else if(arg2)
      callback(arg2);

    return instance;
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends MVC> (this: Model.Type<T>): T;

  static tap <T extends MVC, K extends Model.Key<T>> (this: Model.Type<T>, key: K, expect: true): Exclude<T[K], undefined>;
  static tap <T extends MVC, K extends Model.Key<T>> (this: Model.Type<T>, key: K, expect?: boolean): NoVoid<T[K]>;

  static tap <T extends MVC, R> (this: Model.Type<T>, connect: MVC.TapCallback<T, () => R>): NoVoid<R>;
  static tap <T extends MVC, R> (this: Model.Type<T>, connect: MVC.TapCallback<T, (() => R) | null>): NoVoid<R> | null;

  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

  static tap (arg1?: any, arg2?: boolean): any {
    const instance = this.get();

    return typeof arg1 == "function"
      ? useCompute(instance, arg1, arg2)
      : useSubscribe(instance, arg1, arg2);
  }

  static use <I extends MVC> (this: Model.Type<I>, watch: Model.Key<I>[], callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, apply: Model.Compat<I>, keys?: Model.Event<I>[]): I;

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    return useNew(this, a, b);
  }

  static meta <T extends Class>(this: T): T;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect: true): Exclude<T[K], undefined>;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect?: boolean): T[K];
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

  static meta (arg1?: any, arg2?: any): any {
    return typeof arg1 == "function"
      ? useCompute(this, arg1, arg2)
      : useSubscribe(this, arg1, arg2);
  }
}

export { MVC };