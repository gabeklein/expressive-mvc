import { Context } from '@expressive/mvc';

const Pragma = {} as {
  useContext(create?: boolean): Context;

  useProvider(
    context: Context,
    children: any,
    strict?: boolean
  ): any;

  useFactory<T extends Function>(
    factory: (refresh: () => void) => T
  ): T;

  useLifecycle(callback: () => () => void): void;
};

export { Pragma };

import "./model.as";
import './model.use';
import './model.get';