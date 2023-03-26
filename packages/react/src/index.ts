import { Model } from '@expressive/mvc';

import { useContext } from './useContext';
import { useModel } from './useModel';
import { useTap } from './useTap';

Model.find = useContext;
Model.get = useTap;
Model.use = useModel;

export {
  default,
  Model,
  Debug,
  add,
  ref,
  run,
  set,
  use,
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";
export { get } from './get';