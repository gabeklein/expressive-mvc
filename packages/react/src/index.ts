import { get, Model } from '@expressive/mvc';

import { getContext, useLocal } from './useLocal';
import { useRemote } from './useRemote';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  namespace Model {
    namespace get {
      type Factory<T extends Model, R> = (this: T, current: T, refresh: Refresh) => R;
  
      type Refresh = {
        /** Request a refresh for current component. */
        (): void;
        
        /**
         * Request a refresh and again after promise either resolves or rejects.
         * 
         * @returns Promise which resolves, after refresh, to same value as input.
         */
        <T = void>(passthru: Promise<T>): Promise<T>
    
        /**
         * Request refresh before and after async function.
         * A refresh will occur both before and after the given function.
         * 
         * Any actions performed before first `await` will occur prior to refresh.
         * 
         * @returns Promise which resolves, after refresh, return value.
         */
        <T = void>(invoke: () => Promise<T>): Promise<T>
      };
    }

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, ignore?: true): T;
  
    /** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
    function get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, (() => R) | null>): NoVoid<R> | null;

    namespace use {
      type OnCreate<T extends Model> = (instance: T) => void;
    }

    function use <T extends Model> (this: Model.New<T>, apply?: Model.Values<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.New<T>, callback?: use.OnCreate<T>, repeat?: boolean): T;
  }
}

Model.get = useRemote;
Model.use = useLocal;

get.context = getContext;

export * from '@expressive/mvc';

export { Model as default };
export { Consumer } from "./consumer";
export { Provider } from "./provider";