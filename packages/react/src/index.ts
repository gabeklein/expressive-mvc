import { Control } from '@expressive/mvc';

import { hasModel } from './context';
import { getModel, useModel } from './hooks';

Control.getModel = getModel;
Control.useModel = useModel;
Control.hasModel = hasModel;

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