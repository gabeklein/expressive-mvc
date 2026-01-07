import { Model } from '@expressive/mvc';
import { FunctionComponent, ReactNode } from 'react';

import { createProvider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
    interface FC<
      T extends Model,
      P extends Model.Assign<T>
    > extends FunctionComponent<P & Model.Props<T>> {
      displayName?: string;
      Model: Model.Type<T>;
    }

    function as<T extends Model, P extends Model.Assign<T>>(
      this: Model.Init<T>,
      render: (props: P, self: T) => ReactNode
    ): FC<T, P>;
  }
}

Model.as = function <T extends Model.ReactCompat, P extends Model.Assign<T>>(
  this: Model.Init<T>,
  render: (props: P, self: T) => ReactNode
) {
  const FC: Model.FC<T, P> = (props) => {
    const local = this.use(props, props.is);

    return createProvider(
      local,
      render(props, local),
      props.fallback || local.fallback,
      String(local)
    );
  };

  FC.Model = this;
  FC.displayName = this.name;

  return FC;
};
