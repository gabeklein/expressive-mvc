import { Model } from '@expressive/mvc';

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

function Consumer<T extends Model>(
  props: Consumer.Props<T>): JSX.Element | null {

  const { children, has, get, for: Type } = props as {
    for: Model.New<T>;
    has?: ((value: T) => void) | boolean;
    get?: (value: T | undefined) => void;
    children?: (value: T) => JSX.Element | null;
  }

  const instance = Type.get(!!has) as T;
  const callback = children || has || get;

  if(typeof callback == "function")
    callback(instance);

  return null;
}

export { Consumer };