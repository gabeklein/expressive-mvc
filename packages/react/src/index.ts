import { Context } from '@expressive/mvc';
import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';

import { Pragma } from './adapter';

const Lookup = createContext(new Context());

Pragma.useContext = (create?: boolean) => {
  let ambient = useContext(Lookup);

  if(create){
    useEffect(() => () => ambient.pop(), [ambient]);
    ambient = useMemo(() => ambient.push(), [ambient]);
  }

  return ambient;
}

Pragma.useFactory = (factory) => {
  const state = useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0];
}

Pragma.useMount = (callback) => {
  return useEffect(() => callback(), []);
}

Pragma.useProvider = (value, children) => {
  return createElement(Lookup.Provider, { key: value.id, value, children });
}

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Provider } from './adapter'
export { Lookup };