import { Context } from '@expressive/mvc';
import React from 'react';

import { Pragma } from './hooks';

const Lookup = React.createContext(new Context());

Pragma.useContext = () => React.useContext(Lookup);

Pragma.useMount = (callback) => React.useEffect(() => callback(), []);

Pragma.useFactory = (factory) => {
  const state = React.useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0];
}

import "./component";

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Lookup };
export { Consumer } from "./consumer";
export { Provider } from "./provider";