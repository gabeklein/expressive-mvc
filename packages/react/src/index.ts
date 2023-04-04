import { Model } from '@expressive/mvc';

import { getPeerContext } from './get';
import { useAmbient } from './provider';
import { useGet } from './useGet';
import { useModel } from './useModel';

function useContext<T extends Model>(
  this: Model.Type<T>, required?: boolean): T | undefined {

  return useAmbient().get(this, required);
}

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