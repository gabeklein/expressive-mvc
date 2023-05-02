import { apply, control } from '../control';
import { issues } from '../helper/issues';
import { assign } from '../helper/object';
import { Model } from '../model';
import { mayRetry } from '../suspense';


export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

/**
 * Create a placeholder for specified Model type.
 */
function use <T extends Model> (): T | undefined;
function use <T extends Model> (from: () => T, required: false): T | undefined;
function use <T extends Model> (from: () => T, required: boolean): T;

 /**
  * Create a new child instance of model.
  */
function use <T extends Model> (Type: Model.New<T>, callback?: (i: T) => void): T;

 /**
  * Create a managed child from factory function.
  */
function use <T extends {}> (from: () => Promise<T>, required: false): T | undefined;
function use <T extends {}> (from: () => Promise<T>, required: boolean): T;
function use <T extends {}> (from: () => Promise<T>, callback?: (i: T) => void): T;
function use <T extends {}> (from: () => T, callback?: (i: T) => void): T;

 /**
  * Create child-instance relationship with provided model.
  *
  * Note: If `peer` is not already initialized before parent is
  * (created with `new` as opposed to create method), that model will
  * attach this via `parent()` instruction. It will not, however, if
  * already active.
  */
function use <T extends {}> (peer: T, callback?: (i: T) => void): T;

function use(
  input?: any,
  argument?: boolean | ((i: {} | undefined) => void)){

  return apply((key, source) => {
    const { state, subject } = source;
    const required = argument !== false;

    let pending: Promise<any> | undefined;
    let error: any;

    if(typeof input === "function"){
      if("prototype" in input && input === input.prototype.constructor)
        input = new input();
    }

    else if(input && typeof input !== "object")
      throw Oops.BadArgument(typeof input);

    const onUpdate = (next: Model | undefined) => {
      state[key] = next;

      if(next){
        control(next).parent = subject;
        control(next, true);
      }

      if(typeof argument == "function")
        argument(next);

      return true;
    }

    const suspend = () => {
      if(required === false)
        return;

      const issue = Oops.NotReady(subject, key);

      assign(pending!, {
        message: issue.message,
        stack: issue.stack
      });

      throw pending;
    }

    const initialize = () => {
      const output = typeof input == "function" ?
        mayRetry(() => input.call(subject, subject)) :
        input;

      if(output instanceof Promise){
        pending = output
          .then(val => {
            onUpdate(val);
            return val;
          })
          .catch(err => error = err)
          .finally(() => {
            pending = undefined;
            source.update(key);
          })

        return;
      }

      onUpdate(output);
    }

    if(input !== undefined && required)
      initialize();

    return {
      set: onUpdate,
      get(){
        if(pending)
          return suspend();

        if(error)
          throw error;

        if(!(key in state))
          initialize();

        if(pending)
          return suspend();

        return state[key];
      }
    };
  })
}

export { use }