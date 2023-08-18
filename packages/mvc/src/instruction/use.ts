import { Control, control, parent } from '../control';
import { add, Model } from '../model';

namespace use {
  export type Object<T extends {}> = T;
}

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

/** Create a managed object with observable entries. */
function use <T extends {}, O = use.Object<T>> (data: T, ready?: (object: O) => void): O;

function use(
  value?: any,
  argument?: any[] | ((i: {} | undefined) => void)){

  return add((key, source) => {
    const { subject } = source;

    if(typeof value === "function")
      value = new value();

    function set(next: {} | undefined){
      if(value instanceof Model && !(next instanceof value.constructor))
        throw new Error(`${subject}.${key} expected Model of type ${value.constructor} but got ${next}.`)

      if(next instanceof Model){
        parent(next, subject);
        control(next, true);
      }
      else if(next){
        const control = new Control(value = Object.create(next), false);

        for(const key in control.state = next)
          control.watch(key, {});

        return () => value;
      }

      if(typeof argument == "function")
        argument(next);
    }

    set(value);

    return { set, value };
  })
}

export { use }