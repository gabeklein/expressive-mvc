import { Model } from '@expressive/mvc';

import { useContext } from './useContext';
import { useModel } from './useModel';
import { useTap } from './useTap';

function bootstrap(this: typeof Model){
  this.find = useContext;
  this.get = useTap;
  this.use = useModel;
}

bootstrap.call(Model);

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