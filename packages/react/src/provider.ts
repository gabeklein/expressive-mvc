import Model, { Context } from '@expressive/mvc';
import React from 'react';

import { Lookup } from '.';

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    children?: React.ReactNode;
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  let { children, for: include, set: assign } = props;

  const context = React.useContext(Lookup);
  const value = React.useMemo(() => context.push(), []);
  
  value.include(include, assign);

  React.useEffect(() => () => value.pop(), []);

  return React.createElement(Lookup.Provider, {
    key: value.id, value, children
  });
}

export { Provider };