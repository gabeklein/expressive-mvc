import { Context } from '@expressive/mvc';
import * as react from 'react';

import { Pragma } from './adapter';

Object.assign(Pragma, react);

Pragma.Context = react.createContext(new Context());

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Context, Provider } from './context';
export { Fragment, createElement } from 'react';
// export { type Pragma };
