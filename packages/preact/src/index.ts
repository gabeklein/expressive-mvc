import { Pragma } from '@expressive/react/adapter';
import { useContext, useEffect, useState } from 'preact/compat';

import { Lookup } from './context';

Pragma.useContext = () => useContext(Lookup);

Pragma.useLifecycle = (callback) => useEffect(() => callback(), []);

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

export { Consumer, Provider } from './context';
export { type Pragma };