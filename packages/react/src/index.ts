import { Control } from '@expressive/mvc';

import { fetchRelative, fetchSimple } from './context';
import { useContext, useModel } from './hooks';

Control.getModel = useContext;
Control.useModel = useModel;
Control.hasModel = fetchRelative;
Control.tapModel = fetchSimple;

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