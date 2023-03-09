import React from 'react';

import { Callback, Class, InstanceOf, NonOptionalValues, NoVoid, OptionalValues } from '../helper/types';
import { FindInstruction, Model } from '../model';
import { Global } from '../register';
import { getContextForGetInstruction } from './get';
import { Oops, useContext } from './useContext';
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
  end(force?: boolean): boolean | void {
    const type = this.constructor as typeof MVC;
    
    if(type.keepAlive && !force)
      return false;

    super.end();
    Global.delete(this);

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
    const exists = Global.get(this);

    if(exists)
      if(this.keepAlive)
        return exists;
      else
        throw Oops.AlreadyExists(this.name);

    const instance = super.new(...args) as MVC;

    if(this.global)
      Global.add(instance);

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

  static get(
    arg1?: boolean | MVC.EffectCallback,
    arg2?: MVC.EffectCallback<MVC | undefined>){

    const required = arg1 === undefined || arg1 === true;
    const instance = useContext(this, required);

    if(typeof arg1 === "function" && instance)
      callback(arg1);
    else if(arg2)
      callback(arg2);

    return instance;

    function callback(effect: MVC.EffectCallback<any>){
      try {
        React.useLayoutEffect(() => effect(instance), []);
      }
      catch(err){
        if(instance)
          instance.on(effect, []);
        else
          effect(undefined);
      }
    }
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

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    return useModel(this, a, b);
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