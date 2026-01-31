import { State } from '@expressive/mvc';
import { useContext } from 'solid-js';

import { Lookup } from './context';
import { signalProxy } from './signals';

declare module '@expressive/mvc' {
  namespace State {
    function get<T extends State>(this: State.Type<T>): State.Reactive<T>;
  }
}

State.get = function <T extends State>(this: State.Type<T>) {
  const instance = useContext(Lookup).get(this);

  if (!instance) throw new Error(`State not found in context: ${this.name}`);

  return signalProxy(instance);
};
