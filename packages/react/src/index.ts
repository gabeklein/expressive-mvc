import { Model } from '@expressive/mvc';

import { getPeerContext } from './get';
import { useContext } from './useContext';
import { useGet } from './useGet';
import { useModel } from './useModel';

function bootstrap(this: typeof Model){
  this.fetch = getPeerContext;
  this.find = useContext;
  this.get = useGet;
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
  get
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";