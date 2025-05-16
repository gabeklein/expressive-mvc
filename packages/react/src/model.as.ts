import { Model } from '@expressive/mvc';
import React, { createElement, FunctionComponent, useState } from 'react';

import { Provider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
    interface Component<T extends Model, P extends Model.Assign<T>> extends FunctionComponent<P & Component.Props<T>> {
      displayName?: string;
      Model: Model.Type<T>;
    }

    namespace Component {
      type Props<T extends Model> = 
        & Partial<Pick<T, Exclude<keyof T, keyof Model>>>
        & {
          is?: (instance: T) => void | (() => void);
        }
    }

    function as <T extends Model, P extends Model.Assign<T>> (
      this: Model.Init<T>, render: (props: P, self: T) => React.ReactNode
    ): Component<T, P>;
  }
}

Model.as = function <T extends Model, P extends Model.Assign<T>> (
  this: Model.Init<T>,
  render: (props: P, self: T) => React.ReactNode
){
  if(this === Model)
    throw new Error("Cannot create component from base Model.");

  const Component: Model.Component<T, P> = (props) => {
    const { is, ...rest } = props;
    const self = useState(() => this.new(rest as Model.Assign<T>, is))[0];

    Object.assign(Object.create(self), rest);

    return createElement(Provider, { for: self },
      createElement(() => render(
        props as P, render.length > 1 ? this.get() : undefined as never
      ), {})
    );
  }

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}