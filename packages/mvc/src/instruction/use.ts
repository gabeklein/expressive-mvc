import { add, Control, control, parent } from '../control';
import { Model } from '../model';

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
  input?: any,
  argument?: any[] | ((i: {} | undefined) => void)){

  return add((key, source) => {
    const { subject, state } = source;

    if(typeof input === "function")
      input = new input();

    function set(next: {} | undefined){
      if(input instanceof Model && !(next instanceof input.constructor))
        throw new Error(`${subject}.${key} expected Model of type ${input.constructor} but got ${next}.`)

      if(next instanceof Model){
        parent(next, subject);
        control(next, true);
      }
      else if(next){
        const subject = Object.create(next);
        const control = new Control(subject, false);

        for(const key in control.state = next)
          control.watch(key, {});

        next = subject;
      }

      state[key] = next;

      if(typeof argument == "function")
        argument(next);
    }

    set(input);

    return { set };
  })
}

export { use }