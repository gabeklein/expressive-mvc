import React from 'react';

import { Callback, Class, NonOptionalValues, NoVoid, OptionalValues } from '../helper/types';
import { FindInstruction, Model } from '../model';
import { getContextForGetInstruction } from './get';
import { useContext } from './useContext';
import { useModel } from './useModel';
import { useTap } from './useTap';

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

  static get(
    arg1?: boolean | MVC.EffectCallback,
    arg2?: MVC.EffectCallback<MVC | undefined>){

    const required = arg1 === undefined || arg1 === true;
    const instance = useContext(this, required);
    const effect = typeof arg1 === "function" && instance ? arg1 : arg2;

    if(effect)
      React.useLayoutEffect(() => effect(instance), []);

    return instance;
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends MVC> (this: Model.Type<T>): T;

  static tap <T extends MVC, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: MVC.TapCallback<T, R | (() => R)>, expect?: boolean): R;
  static tap <T extends MVC, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R> | (() => R) | null>, expect?: boolean): R | null;
  static tap <T extends MVC, R extends readonly unknown[] | []> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;

  static tap <T extends MVC, R> (this: Model.Type<T>, init: MVC.TapCallback<T, () => R>): NoVoid<R>;
  static tap <T extends MVC, R> (this: Model.Type<T>, init: MVC.TapCallback<T, (() => R) | null>): NoVoid<R> | null;

  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
  static tap <T extends MVC, R> (this: Model.Type<T>, compute: MVC.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

  static tap <T extends MVC> (this: Model.Type<T>, expect: true): NonOptionalValues<T>;
  static tap <T extends MVC> (this: Model.Type<T>, expect?: boolean): OptionalValues<T>;

  static tap (arg1?: any, arg2?: boolean): any {
    return useTap(this, arg1, arg2);
  }

  static use <I extends MVC> (this: Model.Type<I>, watch: Model.Key<I>[], callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, callback?: (instance: I) => void): I;
  static use <I extends MVC> (this: Model.Type<I>, apply: Model.Compat<I>, keys?: Model.Event<I>[]): I;

  static use <T extends typeof MVC> (this: T, arg1: any, arg2?: any){
    return useModel(this, arg1, arg2);
  }

  protected static meta <T extends Class>(this: T): T;

  protected static meta <T extends Class> (this: T, expect: true): NonOptionalValues<T>;
  protected static meta <T extends Class> (this: T, expect?: boolean): OptionalValues<T>;

  protected static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect: true): Exclude<T, undefined>;
  protected static meta <T, M extends Class> (this: M, from: (this: M, state: M) => Promise<T>, expect?: boolean): T;
  protected static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect: true): Exclude<T, undefined>;
  protected static meta <T, M extends Class> (this: M, from: (this: M, state: M) => T, expect?: boolean): T;

  protected static meta (arg1?: any, arg2?: any): any {
    return useTap(() => this, arg1, arg2);
  }
}

FindInstruction.set(MVC, getContextForGetInstruction);

export { MVC };