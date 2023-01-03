/* istanbul ignore file */
import React from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { Callback, Class, InstanceOf } from '../types';
import { getOwnPropertyNames } from '../util';
import { usePeerContext } from './tap';
import { useLocal } from './useLocal';
import { useModel } from './useModel';
import { useTap } from './useTap';

namespace MVC {
  export type Type<T extends MVC = MVC> = typeof MVC & (new () => T);
}

class MVC extends Model {
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
  static get <I extends MVC, K extends Model.Field<I>> (this: MVC.Type<I>, key: K): I[K];

  /**
   * **React Hook** - Fetch instance.
   * 
   * Effect callback will run once if found, throw if not found.
   * Returned function is called on unmount.
   */
  static get <I extends MVC> (this: MVC.Type<I>, effect:  (found: I) => Callback | void): I;

  static get <T extends typeof MVC> (this: T, arg: any){
    return useLocal(this, arg);
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends MVC> (this: MVC.Type<T>): T;
  static tap <I extends MVC, K extends Model.Field<I>> (this: MVC.Type<I>, key: K, expect: true): Exclude<I[K], undefined>;
  static tap <I extends MVC, K extends Model.Field<I>> (this: MVC.Type<I>, key: K, expect?: boolean): I[K];
  static tap <T, I extends MVC> (this: MVC.Type<I>, from: (this: I, state: I) => Promise<T>, expect: true): Exclude<T, undefined>;
  static tap <T, I extends MVC> (this: MVC.Type<I>, from: (this: I, state: I) => Promise<T>, expect?: boolean): T;
  static tap <T, I extends MVC> (this: MVC.Type<I>, from: (this: I, state: I) => T, expect: true): Exclude<T, undefined>;
  static tap <T, I extends MVC> (this: MVC.Type<I>, from: (this: I, state: I) => T, expect?: boolean): T;

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
  static new <I extends MVC> (this: MVC.Type<I>, callback?: (instance: I) => void): I;
  static new <I extends MVC> (this: MVC.Type<I>, apply: Model.Compat<I>): I;

  static new <I extends MVC> (this: MVC.Type<I>, arg?: ((instance: I) => void) | Model.Compat<I>){
    const instance = React.useMemo(() => {
      const instance = new this() as I;

      Control.for(instance);

      if(typeof arg == "function")
        arg(instance);

      else if(arg)
        getOwnPropertyNames(instance)
          .forEach(((key: Model.Field<I>) => {
            if(key in arg)
              instance[key] = arg[key]!;
          }) as any)

      return instance;
    }, []);

    usePeerContext(instance.is);

    return instance;
  }

  static use <I extends MVC> (
    this: MVC.Type<I>,
    watch: Model.Field<I>[],
    callback?: (instance: I) => void
  ): I;

  static use <I extends MVC> (
    this: MVC.Type<I>,
    callback?: (instance: I) => void
  ): I;

  static use <I extends MVC> (
    this: MVC.Type<I>,
    apply: Model.Compat<I>,
    keys?: Model.Event<I>[]
  ): I;

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    const instance = useModel(this, a, b);
    usePeerContext(instance.is);    
    return instance;
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