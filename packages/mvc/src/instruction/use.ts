import { add, Control, control } from '../control';
import { Model, PARENT } from '../model';

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

function use <T = any> (
  value?: any,
  argument?: any[] | ((i: {} | undefined) => void)){

  return add((property, { subject }) => {
    if(typeof value === "function")
      value = new value();

    const output: Control.Descriptor = { set, value };

    function set(next: Record<string, unknown> | undefined){
      if(value instanceof Model && !(next instanceof value.constructor))
        throw new Error(`${subject}.${property} expected Model of type ${value.constructor} but got ${next}.`)

      if(next instanceof Model){
        PARENT.set(next, subject);
        control(next, true);
      }
      else if(next){
        const proxy = Object.create(next); 

        for(const key in proxy)
          Object.defineProperty(proxy, key, {
            enumerable: true,
            get: () => next[key],
            set(value){
              if(value != next[key]){
                next[key] = value;
                subject.set(property)
              }
            }
          });

        output.get = () => proxy;
      }

      if(typeof argument == "function")
        argument(next);
    }

    set(value);

    return output;
  })
}

export { use }