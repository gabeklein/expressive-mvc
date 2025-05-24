import { createContext, createElement, isValidElement, useContext, useEffect, useMemo, useState } from 'react';

import { Pragma } from './adapter';
import { Context } from './context';

const Lookup = createContext(new Context());

Pragma.useContext = (create?: boolean) => {
  const ambient = useContext(Lookup);

  return create ?
    useMemo(() => ambient.push(), []) :
    ambient;
}

Pragma.useProvider = (context, children, strict = false) => {
  if(!strict || Array.isArray(children) || (
    isValidElement(children) && children.type !== Lookup.Provider
  ))
    return createElement(Lookup.Provider, {
      key: context.id,
      value: context,
      children
    });

  return children;
}

Pragma.useLifecycle = (callback) => {
  return useEffect(() => callback(), []);
}

Pragma.useFactory = (factory) => {
  const state = useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0];
}

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Context, Provider } from './context';
export { Fragment, createElement } from 'react';
export { type Pragma };
