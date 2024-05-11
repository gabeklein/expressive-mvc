import Model from '@expressive/mvc';
import React from 'react';

import { Shared } from './useContext';

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

function Consumer<T extends Model>(props: Consumer.Props<T>){
  const { for: Type } = props;

  if("children" in props)
    return Type.get(props.children);

  const ambient = React.useContext(Shared);
  const onRender = React.useMemo(() => {
    const instance = ambient.get(Type);

    if(!instance && "has" in props)
      throw new Error(`Could not find ${Type} in context.`);

    const callback = "has" in props ? props.has : props.get;
  
    if(typeof callback == "function")
      return () => callback(instance!);
  }, [ambient]);

  if(onRender)
    onRender();

  return null;
}

export { Consumer };