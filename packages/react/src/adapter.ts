import { Context } from '@expressive/mvc';

const Pragma = {} as {
  useContext(): Context;

  useFactory<T extends () => unknown>(
    factory: (refresh: () => void) => T
  ): T;

  useLifecycle(callback: () => () => void): void;
};

export { Pragma };

import "./model.as";
import './model.use';
import './model.get';