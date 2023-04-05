import { Model } from '@expressive/mvc';

import { getPeerContext } from './get';
import { useAmbient } from './provider';
import { useSubscriber } from './useSubscriber';
import { useModel } from './useModel';

function getFromContext<T extends Model>(
  this: Model.Type<T>, required?: boolean): T | undefined {

  return useAmbient().get(this, required);
}

function useGet <T extends Model> (
  this: Model.Class<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean) {

  const instance = this.find(arg1 !== false) as T;
      
  if(typeof arg1 == "boolean")
    return instance;

  return useSubscriber(instance, arg1, arg2);
}

function bootstrap(this: typeof Model){
  this.fetch = getPeerContext;
  this.find = getFromContext;
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