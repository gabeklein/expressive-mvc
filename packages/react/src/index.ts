import { Model } from '@expressive/mvc';

import { getPeerContext } from './get';
import { useAmbient } from './provider';
import { useSubscriber } from './useSubscriber';
import { useModel } from './useModel';

function getFromContext<T extends Model>(
  this: Model.Type<T>,
  callback?: (got: T) => void,
  required?: boolean,
  relativeTo?: Model
){
  if(relativeTo)
    getPeerContext(this, callback!, required, relativeTo);

  else {
    const got = useAmbient().get(this, required);
  
    if(callback && got)
      callback(got);

    return got;
  }
}

function useContext <T extends Model> (
  this: Model.Class<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean){

  let model: T | undefined;
  
  this.find($ => model = $, arg1 !== false);
      
  if(typeof arg1 == "boolean")
    return model;

  return useSubscriber(model!, arg1, arg2);
}

function bootstrap(this: typeof Model){
  this.find = getFromContext;
  this.get = useContext;
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