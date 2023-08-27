import { Context, Model } from '@expressive/mvc';

import { getContext, useLocal } from './useLocal';
import { useRemote } from './useRemote';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  namespace Model {
    namespace GetFactory {
      type Refresh = {
        /** Request a refresh for current component. */
        (): void;
        
        /**
         * Request a refresh and again after promise either resolves or rejects.
         * 
         * @returns Promise which resolves, after refresh, to same value as input.
         */
        <T = void>(passthru: Promise<T>): Promise<T>;
    
        /**
         * Request refresh before and after async function.
         * A refresh will occur both before and after the given function.
         * 
         * Any actions performed before first `await` will occur prior to refresh.
         * 
         * @returns Promise which resolves, after refresh, return value.
         */
        <T = void>(invoke: () => Promise<T>): Promise<T>;
      };
    }

    type GetFactory<T extends Model, R> = (this: T, current: T, refresh: GetFactory.Refresh) => R;

    type UseCallback<T extends Model> = (instance: T) => void;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, ignore?: true): T;
  
    /** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
    function get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, null>): NoVoid<R> | null;

    function use <T extends Model> (this: Model.New<T>, apply?: Model.Values<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.New<T>, callback?: UseCallback<T>, repeat?: boolean): T;
  }
}

Model.get = useRemote;
Model.use = useLocal;

Context.resolve = getContext;

export * from '@expressive/mvc';

export { Model as default };
export { Consumer } from "./consumer";
export { Provider } from "./provider";