import { Model } from '@expressive/mvc';
import { useContext } from 'solid-js';

import { Lookup } from './context';
import { signalProxy } from './signals';

declare module '@expressive/mvc' {
  namespace Model {
    function get<T extends Model>(this: Model.Init<T>): Model.Reactive<T>;
  }
}

Model.get = function <T extends Model>(this: Model.Init<T>) {
  const instance = useContext(Lookup).get(this);

  if (!instance) throw new Error(`Model not found in context: ${this.name}`);

  return signalProxy(instance);
};
