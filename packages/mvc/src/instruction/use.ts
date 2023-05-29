import { apply, Control, control, parent } from '../control';
import { issues } from '../helper/issues';
import { assign, create } from '../helper/object';
import { Model } from '../model';

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
});

type Empty = Record<string, never>;

namespace use {
  type Key<T extends {}> = Extract<keyof T, string>;

  /**
   * Assign value to observable property.
   * 
   * If property is not already observed, it will become so.
   */
  type SetValue<T extends {}> =
    <K extends Key<T>> (property: K, value: T[K]) => void;
  
  /**
   * Observe property for updates.
   * 
   * If property is not already observed, it will become so.
   */
  type OnUpdate<T extends {}> =
    <K extends Key<T>> (
      property: K,
      callback: (value: T[K], key: K) => void
    ) => () => void;
  
  export type Observable<T extends {}> = T & {
    set: SetValue<T>;
    on: OnUpdate<T>;
  }
  
  export type Collection<T> = Observable<{ [key: string | number]: T }>;
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
function use <T = any, C = use.Collection<T>> (record: Empty, ready?: (object: C) => void): C;

/** Create a managed object with observable entries. */
function use <T extends {}, O = use.Observable<T>> (data: T, ready?: (object: O) => void): O;

function use(
  input?: any,
  argument?: any[] | ((i: {} | undefined) => void)){

  return apply((key, source) => {
    const { state, subject } = source;

    if(typeof input === "function")
      input = new input();
    else if(input && typeof input !== "object")
      throw Oops.BadArgument(typeof input);

    function set(next: {} | undefined){
      if(next instanceof Model){
        parent(next, subject);
        control(next, true);
      }
      else if(next)
        next = manage(next);

      state[key] = next;

      if(typeof argument == "function")
        argument(next);

      return true;
    }

    set(input);

    return { set };
  })
}

function manage<T extends {}>(next: T){
  const methods = <use.Observable<T>>{
    on(key, callback){
      if(!(key in next))
        control.watch(key, { value: subject[key] });

      return control.addListener(k => {
        if(k === key)
          return () => callback(next[key], key);

        if(typeof k !== "string")
          return k;
      }) as any;
    },
    set(key, value){
      if(key in next)
        subject[key] = value;
      else
        control.watch(key, { value });
    }
  }

  const subject = assign(create(next), methods);
  const control = new Control<T>(subject);

  for(const key in control.state = next)
    control.watch(key, {});

  return subject;
}

export { use }