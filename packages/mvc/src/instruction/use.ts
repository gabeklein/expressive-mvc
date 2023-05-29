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

namespace use {
  /**
   * Assign value to observable property.
   * 
   * If property is not already observed, it will become so.
   */
  type SetValue<T extends {}> = <K extends keyof T> (property: K, value: T[K]) => void;
  
  /**
   * Observe property for updates.
   * 
   * If property is not already observed, it will become so.
   */
  type OnUpdate<T extends {}> =
    <K extends keyof T> (
      property: K,
      callback: (value: T[K], key: K) => void
    ) => () => void;
  
  export type Observable<T extends {}> = T & {
    set: SetValue<T>;
    on: OnUpdate<T>;
  }
  
  export type Collection<T> = Observable<{ [key: string | number]: T }>;
  
  export type Child<T extends {}> = T extends Model ? T : Observable<T>;
}

/** Create a placeholder for specified Model type. */
function use <T extends Model> (): T | undefined;

/** Create a new child instance of model. */
function use <T extends Model> (Type: Model.New<T>, callback?: (i: T) => void): use.Child<T>;

function use <T extends Model> (model: T): T;

/** Create a managed record with observable entries. */
function use <T = any> (data: Record<string, never>): use.Collection<T>;

/** Create a managed object with observable entries. */
function use <T extends {}> (data: T): use.Observable<T>;

/**
  * Create child-instance relationship with provided model.
  *
  * Note: If `peer` is not already initialized before parent is
  * (created with `new` as opposed to create method), that model will
  * attach this via `parent()` instruction. It will not, however, if
  * already active.
  */
function use <T extends Model> (peer: T, callback?: (i: T) => void): T;

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

function manage<T extends Record<string, any>>(next: T){
  const subject = assign(create(next), {
    on(
      key: string,
      callback: (value: any, key: string) => void){

      if(!(key in next))
        control.watch(key, { value: subject[key] });

      return control.addListener(k => {
        if(k === key)
          return () => callback(next[k], k);

        if(typeof k !== "string")
          return k;
      });
    },
    set(key: string, value: any){
      if(key in next)
        subject[key] = value;
      else
        control.watch(key, { value });
    }
  })

  const control = new Control(subject);

  for(const key in control.state = next)
    control.watch(key, {});

  return subject;
}

export { use }