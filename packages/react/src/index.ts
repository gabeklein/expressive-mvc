import { Context, Model } from '@expressive/mvc';

import { component } from './component';
import { getContext } from './useContext';
import { useLocal } from './useLocal';
import { useRemote } from './useRemote';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  namespace Model {
    namespace get {
      type Factory<T extends Model, R> = (this: T, current: T, refresh: ForceRefresh) => R;

      type ForceRefresh = {
        /** Request a refresh for current component. */
        (): void;
        
        /**
         * Request a refresh and again after promise either resolves or rejects.
         * 
         * @param waitFor Promise to wait for.
         * @returns Promise which resolves, after refresh, to same value as `waitFor`.
         */
        <T = void>(waitFor: Promise<T>): Promise<T>;
    
        /**
         * Request refresh before and after async function.
         * A refresh will occur both before and after the given function.
         * 
         * **Note:** Any actions performed before first `await` will occur prior to refresh.
         * 
         * @param invoke Async function to invoke.
         * @returns Promise which resolves returned value after refresh.
         */
        <T = void>(invoke: () => Promise<T>): Promise<T>;
      };
    }

    interface Component<T extends Model, P extends Model.Values<T>> {
      (props: P): JSX.Element;

      using: Model.Type<T>;
      displayName: string;
    }

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, ignore?: true): T;
  
    /** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
    function get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: get.Factory<T, null>): NoVoid<R> | null;

    function use <T extends Model> (this: Model.New<T>, apply?: Model.Values<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.New<T>, callback?: ((instance: T) => void), repeat?: boolean): T;

    /**
     * Creates a component which reflects this Model. All managed properties may be assigned using props.
     * 
     * @param render Function which renders component. This function receives all Model state merged with props. Normal subscription behavior still applies.
     */
    function as <T extends Model, P = {}> (
      this: Model.New<T>, render: (using: T & P) => React.ReactNode
    ): Component<T, P & Model.Values<T>>;
  }
}

Model.get = useRemote;
Model.use = useLocal;
Model.as = component;

Context.get = getContext;

export { Model, Model as default };
export { add, get, use, ref, set } from '@expressive/mvc';
export { Consumer } from "./consumer";
export { Provider } from "./provider";
export { has } from './has';