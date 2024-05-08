import { Model } from '@expressive/mvc';

import { createComponent } from './component';
import { useLocal } from './useLocal';
import { useRemote } from './useRemote';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

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

declare module '@expressive/mvc' {
  namespace Model {
    type GetFrom<T extends Model, R> =
      (this: T, current: T, refresh: ForceRefresh) => R;

    interface Component<T extends Model, P extends Model.Assign<T>> {
      (props: P): JSX.Element;

      Model: Model.Type<T>;
      displayName: string;
    }

    /**
     * Creates a component which reflects this Model. All managed properties may be assigned using props.
     * 
     * @param render Function which renders component. This function receives all Model state merged with props. Normal subscription behavior still applies.
     */
    function as <T extends Model, P extends Model.Assign<T>> (
      this: Model.Init<T>, render: (using: P) => React.ReactNode
    ): Component<T, P & Model.Assign<T>>;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>): T;
  
    /** Fetch instance of this class optionally. */
    function get <T extends Model> (this: Model.Type<T>, expect: false): T | undefined;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, expectValues: true): Required<T>
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFrom<T, Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFrom<T, null>): NoVoid<R> | null;

    function use <T extends Model> (this: Model.Init<T>, apply?: Model.Assign<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.Init<T>, callback?: Model.Callback<T>, repeat?: boolean): T;
  }
}

Model.as = createComponent;
Model.get = useRemote;
Model.use = useLocal;

export { Model, Model as default };
export { get, use, ref, set, has } from '@expressive/mvc';
export { Consumer } from "./consumer";
export { Provider } from "./provider";