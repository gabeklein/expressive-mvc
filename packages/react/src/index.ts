import { Model } from '@expressive/mvc';

import { hasContext, useFromContext } from './useContext';
import { useModel } from './useModel';

Model.has = hasContext;
Model.get = useFromContext;
Model.use = useModel;

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