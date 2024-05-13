import { Context } from '@expressive/mvc';

const Pragma = {} as {
  useContext(create?: boolean): Context;

  useFactory<T extends () => unknown>(
    factory: (refresh: () => void) => T
  ): T;

  useMount(callback: () => () => void): void;

  useProvider(context: Context, children: any): any;
};

export { Pragma };

import './model.use';
import './model.get';