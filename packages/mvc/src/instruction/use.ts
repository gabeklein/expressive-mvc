import { apply, Control, control, parent } from '../control';
import { issues } from '../helper/issues';
import { assign, create } from '../helper/object';
import { Model } from '../model';
import { mayRetry } from '../suspense';

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

/** Create a placeholder for specified Model type. */
function use <T extends Model> (): T | undefined;

/** Create a new child instance of model. */
function use <T extends Model> (Type: Model.New<T>, callback?: (i: T) => void): T;

/** Assign the result of a factory as a child model. */
function use <T extends {}> (from: () => Promise<T> | T, required?: true): T;

/** Assign the result of a factory as a child model. */
function use <T extends {}> (from: () => Promise<T> | T, required: boolean): T | undefined;

/** Create a managed child from factory function. */
function use <T extends {}> (from: () => Promise<T> | T, callback?: (i: T) => void): T;

function use <T extends {}> (data: T): T;

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
  argument?: boolean | ((i: {} | undefined) => void)){

  return apply((key, source) => {
    const { state, subject } = source;
    const required = argument !== false;

    if(typeof input === "function"){
      if("prototype" in input && input === input.prototype.constructor)
        input = new input();
    }

    else if(input && typeof input !== "object")
      throw Oops.BadArgument(typeof input);

    function init(){
      const result = typeof input == "function" ?
        mayRetry(() => input.call(subject, subject)) :
        input;

      if(result instanceof Promise){
        const pending = result
          .then(value => {
            output.get = undefined;
            update(value);
            return value;
          })
          .catch(err => {
            output.get = () => { throw err };
          })
          .finally(() => {
            source.update(key);
          });

        if(required !== false)
          return () => {
            throw assign(pending, Oops.NotReady(subject, key));
          };
      }
      else
        update(result);
    }

    function update(next: {} | undefined){
      if(next instanceof Model){
        parent(next, subject);
        control(next, true);
      }
      else if(next) {
        const control = new Control(create(next));

        control.state = next;

        for(const key in next)
          control.watch(key, {});

        next = control.subject;
      }

      state[key] = next;

      if(typeof argument == "function")
        argument(next);

      return true;
    }

    const output: Control.PropertyDescriptor = {
      set: update,
      get: input && required
        ? init()
        : () => {
          const get = output.get = init();
          return get ? get() : state[key];
        }
    };

    return output;
  })
}

export { use }