import { Model } from '@expressive/mvc';
import React, { FunctionComponent } from 'react';

import { createProvider } from './context';

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
          fallback?: React.ReactNode;
        }
    }

    function as <T extends Model, P extends Model.Assign<T>> (
      this: Model.Init<T>, render: (props: P, self: T) => React.ReactNode
    ): Component<T, P>;
  }
}

Model.as = function <T extends Model.Compat, P extends Model.Assign<T>> (
  this: Model.Init<T>,
  render: (props: P, self: T) => React.ReactNode
){
  if(this === Model)
    throw new Error("Cannot create component from base Model.");

  const Component: Model.Component<T, P> = (props) => {
    const local = this.use((self) => {
      self.set(props);

      if(props.is)
        return props.is(self);
    });

    local.set(props);

    return createProvider(
      local,
      render(props, local),
      props.fallback || local.fallback,
      String(local)
    );
  }

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}