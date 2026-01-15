import { Model } from '@expressive/mvc';
import { onCleanup } from 'solid-js';

import { signalProxy } from './signals';

declare module '@expressive/mvc' {
  namespace Model {
    function use<T extends Model>(
      this: Model.Type<T>,
      apply?: Model.Assign<T>
    ): Model.Reactive<T>;
  }
}

Model.use = function <T extends Model>(
  this: Model.Type<T>,
  argument?: Model.Assign<T>
) {
  const instance = this.new(argument);
  const proxy = signalProxy(instance);

  onCleanup(() => instance.set(null));

  return proxy;
};
