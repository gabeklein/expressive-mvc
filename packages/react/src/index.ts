import { Control } from '@expressive/mvc';

import { hasModel } from './context';
import { getModel, useModel } from './hooks';

Control.get = getModel;
Control.use = useModel;
Control.has = hasModel;

export {
  default,
  Model,
  Debug,
  Control,
  ref,
  run,
  set,
  use,
  get
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";