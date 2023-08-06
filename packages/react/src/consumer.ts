import { Model } from '@expressive/mvc';
import { ReactElement } from 'react';

declare namespace Consumer {
  type HasProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /**
     * Getter function. Is called on every natural render of this component.
     * Will throw if usable instance cannot be found in context.
     */
    has: (value: T) => void;
  }

  type GetProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /** Getter function. Is called on every natural render of this component. */
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
    children: (value: T) => ReactElement<any, any> | null;
  }

  type Props<T extends Model> = HasProps<T> | GetProps<T> | RenderProps<T>
}

function Consumer<T extends Model>(
  props: Consumer.Props<T>): ReactElement<any, any> | null {

  type For<T extends Model> = Model.Type<T> & typeof Model;

  const { children, has, get, for: Type } = props as {
    for: For<T>;
    has?: (value: T) => void;
    get?: (value: T | undefined) => void;
    children?: (value: T) => ReactElement<any, any> | null;
  }

  if(typeof children == "function")
    return children(Type.get());

  const callback = has || get;

  if(typeof callback == "function")
    callback(Type.get(!!has) as T);

  return null;
}

export { Consumer };