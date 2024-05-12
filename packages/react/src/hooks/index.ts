import { Context } from '@expressive/mvc';

const Pragma = {} as {
  useContext(): Context;

  useFactory<T extends () => unknown>(
    factory: (refresh: () => void) => T
  ): T;

  useMount(callback: () => () => void): void;
};

export { Pragma };

import './use';
import './get';