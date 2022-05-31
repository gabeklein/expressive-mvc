import React from 'react';

import { issues } from '../issues';
import { Class } from '../types';
import { useLocal } from './useLocal';
import { useTap } from './useTap';

export const Oops = issues({
  BadProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

declare namespace Consumer {
  type HasProps<E extends Class> = {
      /** @deprecated - use for instead */
      of?: never;

      /** Type of controller to fetch from context. */
      for: E;

      /**
       * Getter function. Is called on every natural render of this component.
       * Will throw if usable instance cannot be found in context.
       */
      has: (value: InstanceType<E>) => void;
  }

  type GetProps<E extends Class> = {
      /** @deprecated - use for instead */
      of?: never;

      /** Type of controller to fetch from context. */
      for: E;

      /** Getter function. Is called on every natural render of this component. */
      get: (value: InstanceType<E> | undefined) => void;
  }

  type RenderProps<E extends Class> = {
      /** @deprecated - use for instead */
      of?: never;

      /** Type of controller to fetch from context. */
      for: E;

      /**
       * Render function, will receive instance of desired controller.
       *
       * Similar to `tap()`, updates to properties accessed in
       * this function will cause a refresh when they change.
       */
      children: (value: InstanceType<E>) => React.ReactElement<any, any> | null;
  }

  type Props<T extends Class> = HasProps<T> | GetProps<T> | RenderProps<T>
}

function Consumer<T extends Class>(props: Consumer.Props<T>){
  const { get, has, children, for: type } = props as any;

  if(typeof children == "function")
    return children(useTap(type));

  const callback = has || get;

  if(typeof callback == "function")
    callback(useLocal(type, !!has));
  else
    throw Oops.BadProps()

  return null;
}

export { Consumer };