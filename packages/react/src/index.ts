import { Control } from '@expressive/mvc';

import { fetch } from './context';
import { useContext } from './useContext';
import { useModel } from './useModel';

Control.hasModel = fetch;
Control.getModel = useContext;
Control.useModel = useModel;

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