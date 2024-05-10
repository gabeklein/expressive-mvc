import { Context, Model } from '@expressive/mvc';
import { FunctionComponentElement, ReactNode } from 'react';

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
    type GetFactory<T extends Model, R> =
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
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, null>): NoVoid<R> | null;

    function use <T extends Model> (this: Model.Init<T>, apply?: Model.Assign<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.Init<T>, callback?: Model.Callback<T>, repeat?: boolean): T;
  }
}

declare namespace Provider {
  type Element = FunctionComponentElement<{
    value: Context;
    children?: ReactNode;
  }>;

  type Item = Model | Model.Init;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    children?: React.ReactNode;
    use?: Model.Assign<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: React.ReactNode;
    use?: Model.Assign<Instance<T>>;
  }
}

declare function Provider <T extends Provider.Item> (props: Provider.Props<T>): Provider.Element;

declare namespace Consumer {
  type HasProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /**
     * If boolean, will assert controller of type `for` is present in context.
     * 
     * If function, will called on every natural render of this component.
     * Will throw if usable instance cannot be found in context.
     */
    has: ((value: T) => void) | boolean;
  }

  type GetProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /** Function called on every natural render of this component. */
    get: (value: T | undefined) => void;
  }

  type RenderProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Similar to `get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => JSX.Element | null;
  }

  type Props<T extends Model> = HasProps<T> | GetProps<T> | RenderProps<T>
}

declare function Consumer <T extends Model> (props: Consumer.Props<T>): JSX.Element | null;

export { Model, Model as default };
export { get, use, ref, set, has } from '@expressive/mvc';
export { Consumer };
export { Provider };