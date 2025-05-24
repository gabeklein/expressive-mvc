import { Pragma } from '@expressive/react/adapter';
import * as compat from 'preact/compat';

Object.assign(Pragma, compat);

export {
  Model, Model as default,
  get, use, ref, set, has
} from '@expressive/mvc';

export { Consumer, Provider } from './context';
export { type Pragma };