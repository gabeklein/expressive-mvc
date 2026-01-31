import { State } from '@expressive/mvc';
import { onCleanup } from 'solid-js';

import { signalProxy } from './signals';

declare module '@expressive/mvc' {
  namespace State {
    function use<T extends State>(
      this: State.Type<T>,
      apply?: State.Assign<T>
    ): State.Reactive<T>;
  }
}

State.use = function <T extends State>(
  this: State.Type<T>,
  argument?: State.Assign<T>
) {
  const instance = this.new(argument);
  const proxy = signalProxy(instance);

  onCleanup(() => instance.set(null));

  return proxy;
};
