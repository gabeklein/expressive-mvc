import { event } from '../control';
import { Model, PARENT } from '../model';
import { add } from './add';

/** Create a placeholder for specified Model type. */
function use <T extends Model> (): T | undefined;

/** Create a new child instance of model. */
function use <T extends Model> (Type: Model.New<T>, ready?: (i: T) => void): T;

/**
 * Use existing model as a child of model assigned to.
 * 
 * Note: If `peer` is not already initialized before parent is
 * (created with `new` as opposed to create method), that model will
 * attach this via `parent()` instruction. It will not, however, if
 * already active.
 **/
function use <T extends Model> (model: T, ready?: (i: T) => void): T;

function use <T extends Model> (
  value?: T | Model.New<T>,
  argument?: any[] | ((i: {} | undefined) => void)){

  return add((property, subject) => {
    if(typeof value === "function")
      value = new value();

    function set(next: Model | undefined){
      if(value instanceof Model && !(next instanceof value.constructor))
        throw new Error(`${subject}.${property} expected Model of type ${value.constructor} but got ${next}.`)

      if(next instanceof Model){
        PARENT.set(next, subject);
        event(next, true);
      }

      if(typeof argument == "function")
        argument(next);
    }

    set(value);

    return { set, value };
  })
}

export { use }