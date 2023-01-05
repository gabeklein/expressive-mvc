import { Model } from '../model';
import { Callback, Class } from '../types';
import { useContext } from './useContext';
import { useModel } from './useModel';
import { useTap } from './useTap';

class MVC extends Model {
  /**
   * **React Hook** - Fetch most instance of this controller from context, if it exists.
   * 
   * @param required - Unless false, will throw where instance cannot be found.
   */
  static get <T extends MVC> (this: Model.Type<T>, required?: boolean): T;

  /**
   * **React Hook** - Fetch most instance of this controller from context.
   * 
   * @param required - If false, may return undefined.
   */
  static get <T extends MVC> (this: Model.Type<T>, required: false): T | undefined;

  /**
   * **React Hook** - Fetch specific value from instance of this controller in context.
   */
  static get <I extends MVC, K extends Model.Field<I>> (this: Model.Type<I>, key: K): I[K];

  /**
   * **React Hook** - Fetch instance.
   * 
   * Effect callback will run once if found, throw if not found.
   * Returned function is called on unmount.
   */
  static get <I extends MVC> (this: Model.Type<I>, effect: (found: I) => Callback | void): I;

  static get <T extends typeof MVC> (this: T, arg: any){
    return useContext(this, arg);
  }

  /** 
   * **React Hook** - Fetch and subscribe to instance of this controller within ambient component.
   */
  static tap <T extends MVC> (this: Model.Type<T>): T;
  static tap <I extends MVC, K extends Model.Field<I>> (this: Model.Type<I>, key: K, expect: true): Exclude<I[K], undefined>;
  static tap <I extends MVC, K extends Model.Field<I>> (this: Model.Type<I>, key: K, expect?: boolean): I[K];
  static tap <T, I extends MVC> (this: Model.Type<I>, from: (this: I, state: I) => Promise<T>, expect: true): Exclude<T, undefined>;
  static tap <T, I extends MVC> (this: Model.Type<I>, from: (this: I, state: I) => Promise<T>, expect?: boolean): T;
  static tap <T, I extends MVC> (this: Model.Type<I>, from: (this: I, state: I) => T, expect: true): Exclude<T, undefined>;
  static tap <T, I extends MVC> (this: Model.Type<I>, from: (this: I, state: I) => T, expect?: boolean): T;

  static tap (key?: string | Function, expect?: boolean): any {
    return useTap(this, key as any, expect);
  }

  static use <I extends MVC> (
    this: Model.Type<I>,
    watch: Model.Field<I>[],
    callback?: (instance: I) => void
  ): I;

  static use <I extends MVC> (
    this: Model.Type<I>,
    callback?: (instance: I) => void
  ): I;

  static use <I extends MVC> (
    this: Model.Type<I>,
    apply: Model.Compat<I>,
    keys?: Model.Event<I>[]
  ): I;

  static use <T extends typeof MVC> (this: T, a: any, b?: any){
    return useModel(this, a, b);
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