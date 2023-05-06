import { issues, Model } from '@expressive/mvc';

export const Oops = issues({
  BadProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

declare namespace Consumer {
  type HasProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Class<T>;

    /**
     * Getter function. Is called on every natural render of this component.
     * Will throw if usable instance cannot be found in context.
     */
    has: (value: T) => void;
  }

  type GetProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Class<T>;

    /** Getter function. Is called on every natural render of this component. */
    get: (value: T | undefined) => void;
  }

  type RenderProps<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Class<T>;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Similar to `get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => React.ReactElement<any, any> | null;
  }

  type Props<T extends Model> = HasProps<T> | GetProps<T> | RenderProps<T>
}

function Consumer<T extends Model>(props: Consumer.Props<T>){
  const { children, has, get, for: type } = props as {
    for: Model.Class<T>;
    has?: (value: T) => void;
    get?: (value: T | undefined) => void;
    children?: (value: T) => React.ReactElement<any, any> | null;
  };

  if(typeof children == "function")
    return children(type.get());

  const callback = has || get;

  if(typeof callback == "function")
    callback(type.get(!!has) as T);
  else
    throw Oops.BadProps();

  return null;
}

export { Consumer };