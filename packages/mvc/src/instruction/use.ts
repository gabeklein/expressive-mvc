import { add, Control, control, parent } from '../control';
import { create } from '../helper/object';
import { Model } from '../model';

type Empty = Record<string, never>;

namespace use {
  export type Record<T> = { [key: string | number]: T } & Model.Observable;
  export type Object<T extends {}> = T & Model.Observable;
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

/** Create a managed record with observable entries. */
function use <T = any, C = use.Record<T>> (record: Empty, ready?: (object: C) => void): C;

/** Create a managed object with observable entries. */
function use <T extends {}, O = use.Object<T>> (data: T, ready?: (object: O) => void): O;

function use(
  input?: any,
  argument?: any[] | ((i: {} | undefined) => void)){

  return add((key, source) => {
    const { state, subject } = source;

    if(typeof input === "function")
      input = new input();

    function set(next: {} | undefined){
      if(next instanceof Model){
        parent(next, subject);
        control(next, true);
      }
      else if(next){
        const subject = create(next);
        const control = new Control(subject, false);

        for(const key in control.state = next)
          control.watch(key, {});

        next = subject;
      }

      state[key] = next;

      if(typeof argument == "function")
        argument(next);

      return true;
    }

    set(input);

    return { set };
  })
}

export { use }