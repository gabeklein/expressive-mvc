import Model, { Context } from '@expressive/mvc';
import React from 'react';

import { Shared, useMount, useContext } from './useContext';

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    children?: React.ReactNode;
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  let { children, for: include, set: assign } = props;

  const context = useContext();
  const value = React.useMemo(() => context.push(), []);
  
  value.include(include, assign);

  useMount(() => () => value.pop());

  return React.createElement(Shared.Provider, {
    key: value.id, value, children
  });
}

export { Provider };