import { Context } from '@expressive/mvc';
import { Pragma } from "@expressive/react/hooks";
import { createContext } from 'preact';
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

export { Lookup, Pragma };
// export { Consumer } from "./consumer";
// export { Provider } from "./provider";