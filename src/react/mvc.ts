/* istanbul ignore file */
import React from 'react';

import { Controller } from '../controller';
import { CONTROL, Model } from '../model';
import { ensure } from '../stateful';
import { Callback, Class, InstanceOf } from '../types';
import { getOwnPropertyNames } from '../util';
import { usePeerContext } from './tap';
import { useLocal } from './useLocal';
import { useModel } from './useModel';
import { useTap } from './useTap';


class MVC extends Model {
  static [CONTROL]: Controller;

  /** Attaches this controller to a component. */
  tap(): this;
  tap <K extends Model.Field<this>> (key: K, expect: true): Exclude<this[K], undefined>;
  tap <K extends Model.Field<this>> (key: K, expect?: boolean): this[K];
  tap <T> (from: (this: this, state: this) => Promise<T>, expect: true): Exclude<T, undefined>;
  tap <T> (from: (this: this, state: this) => Promise<T>, expect?: boolean): T | undefined;
  tap <T> (from: (this: this, state: this) => T, expect: true): Exclude<T, undefined>;
  tap <T> (from: (this: this, state: this) => T, expect?: boolean): T;

  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path as any, expect);
  }

  /**
   * **React Hook** - Subscribe to instance of controller within a component.
   *
   * @param callback - Run once before subscription begins.
   */
  use(watch: Model.Field<this>[], callback?: (instance: this) => void): this;
  use(callback?: (instance: this) => void): this;

  use(arg?: any, callback?: (instance: this) => void) {
    return useModel(this, arg, callback);
  }

  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends Class> (this: T, required?: boolean): InstanceOf<T>;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends Class> (this: T, required: false): InstanceOf<T> | undefined;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <T extends Class, I extends InstanceOf<T>, K extends Model.Field<I>> (this: T, key: K): I[K];

  /**
   * **React Hook** - Fetch instance.
   * 
   * Effect callback will run once if found, throw if not found.
   * Returned function is called on unmount.
   */
  static get <T extends Class, I extends InstanceOf<T>> (this: T, effect: (found: I) => Callback | void): I;

  static get <T extends typeof MVC> (this: T, arg: any){
    return useLocal(this, arg);
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends Class> (this: T): InstanceOf<T>;
  static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Field<I>> (this: T, key: K, expect: true): Exclude<I[K], undefined>;
  static tap <T extends Class, I extends InstanceOf<T>, K extends Model.Field<I>> (this: T, key: K, expect?: boolean): I[K];
  static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect: true): Exclude<T, undefined>;
  static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => Promise<T>, expect?: boolean): T;
  static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect: true): Exclude<T, undefined>;
  static tap <T, M extends Class, I extends InstanceOf<M>> (this: M, from: (this: I, state: I) => T, expect?: boolean): T;

  static tap (key?: string | Function, expect?: boolean): any {
    return useTap(this, key as any, expect);
  }

  /**
   * **React Hook** - Spawn and maintain a controller from within a component.
   * 
   * More efficient than `use()` if you don't need hook-based features.
   * 
   * @param callback - Run after creation of instance.
   */
  static new <T extends Class, I extends InstanceOf<T>> (this: T, callback?: (instance: I) => void): I;
  static new <T extends Class, I extends InstanceOf<T>> (this: T, apply: Model.Compat<I>): I;

  static new <T extends Class, I extends InstanceOf<T>> (this: T, arg?: ((instance: I) => void) | Model.Compat<I>){
    const instance = React.useMemo(() => {
      const instance: I = new this();

      ensure(instance);

      if(typeof arg == "function")
        arg(instance);

      else if(arg)
        getOwnPropertyNames(instance).forEach(key => {
          if(key in arg)
            instance[key] = arg[key];
        })

      return instance;
    }, []);

    usePeerContext(instance.get);

    return instance;
  }

  static use <T extends Class, I extends InstanceOf<T>> (
    this: T,
    watch: Model.Field<I>[],
    callback?: (instance: I) => void
  ): I;

  static use <T extends Class, I extends InstanceOf<T>> (
    this: T,
    callback?: (instance: I) => void
  ): I;

  static use <T extends Class, I extends InstanceOf<T>> (
    this: T,
    apply: Model.Compat<I>,
    keys?: Model.Event<I>[]
  ): I;

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    const instance = useModel(this, a, b);
    usePeerContext(instance.get);    
    return instance;
  }

  /**
   * @deprecated consider doing this manually - not worth minor efficiency gain over using.
  */
  static uses <T extends typeof MVC, I extends InstanceOf<T>, D extends Model.Compat<I>> (
    this: T, apply: D, keys?: (keyof D)[]){

    return this.use(instance => {
      instance.import(apply, keys);
    })
  }

  /**
   * @deprecated is now replaced by overload of `use` method.
  */
  static using <T extends typeof MVC, I extends InstanceOf<T>> (
    this: T,
    apply: Model.Compat<I>,
    keys?: Model.Event<I>[]){

    return this.use(apply, keys);
  }

  static meta <T extends Class>(this: T): T;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect: true): Exclude<T[K], undefined>;
  static meta <T extends Class, K extends keyof T> (this: T, key: K, expect?: boolean): T[K];
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
  static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

  static meta (path?: string | Function, expect?: boolean): any {
    return useTap(() => this, path as any, expect);
  }
}

export { MVC };