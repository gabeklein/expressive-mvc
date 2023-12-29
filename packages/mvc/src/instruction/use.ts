import { Model, update } from '../model';
import { add } from './add';

function use <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;

/** Create a new child instance of model. */
function use <T extends Model> (Type: Model.Type<T>, ready?: (i: T) => void): T;

function use <T extends Model> (
  model: Model.Type<T>,
  argument?: ((i: T | undefined) => void) | boolean){

  return add((key, subject) => {
    const value = new model();

    function set(next: Model | undefined){
      if(next ? !(next instanceof model) : argument !== false)
        throw new Error(`${subject}.${key} expected Model of type ${model} but got ${next && next.constructor}.`)

      update(subject, key, next);

      if(typeof argument == "function")
        argument(next as T);

      return false;
    }

    set(value);

    return { set, value };
  })
}

export { use }