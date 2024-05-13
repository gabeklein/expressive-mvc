import { Context } from '@expressive/mvc';
import { Pragma, Consumer, Provider } from "@expressive/react/adapter";
import { createContext, createElement } from 'preact';
import { useContext, useEffect, useState } from "preact/compat";

const Lookup = createContext(new Context());

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

Pragma.useContext = () => useContext(Lookup);

Pragma.useMount = (callback) => useEffect(() => callback(), []);

Pragma.useFactory = (factory) => {
  const state = useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0];
}

Pragma.useProvider = (value, children) => {
  return createElement(Lookup.Provider, { key: value.id, value, children });
}

export { Lookup, Consumer, Provider };