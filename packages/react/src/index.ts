import { Context } from '@expressive/mvc';
import React from 'react';

import { Pragma } from './hooks';

const Lookup = React.createContext(new Context());

Pragma.useContext = (create?: boolean) => {
  let ambient = React.useContext(Lookup);

  if(create){
    React.useEffect(() => () => ambient.pop(), [ambient]);
    ambient = React.useMemo(() => ambient.push(), [ambient]);
  }

  return ambient;
}

Pragma.useMount = (callback) => {
  return React.useEffect(() => callback(), []);
}

Pragma.useFactory = (factory) => {
  const state = React.useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0];
}

Pragma.useProvider = (context, children) => {
  return React.createElement(Lookup.Provider, {
    value: context, key: context.id
  }, children);
}

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Provider } from './hooks'
export { Lookup, Pragma };