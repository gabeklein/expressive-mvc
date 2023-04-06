import { Model } from '@expressive/mvc';

import { hasContext } from './get';
import { useSubscriber } from './useSubscriber';
import { useModel } from './useModel';

function useContext <T extends Model> (
  this: Model.Class<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean){

  let model: T | undefined;
  
  this.has($ => model = $, arg1 !== false);
      
  if(typeof arg1 == "boolean")
    return model;

  return useSubscriber(model!, arg1, arg2);
}

function bootstrap(this: typeof Model){
  this.has = hasContext;
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