import { Control, add } from '../control';
import { createValueEffect } from '../effect';
import { issues } from '../helper/issues';
import { assign } from '../helper/object';
import { mayRetry, suspense } from '../suspense';

export const Oops = issues({
  ComputeFailed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
});

declare namespace set {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;

  type Factory<T, S = any> = (this: S, key: string, thisArg: S) => Promise<T> | T;
}

/**
 * Set property with a placeholder.
 * 
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (ala: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 */
function set <T = any>(): T;

/**
 * Set property with a factory function.
 *
 * If async, poperty cannot be accessed until resolves, yeilding a result.
 * If accessed while still processing, React Suspense will be thrown.
 *
 * - `required: true` (default) -
 *      Run factory immediately upon creation of model instance.
 * - `required: false` -
 *      Run factory only if/when accessed.
 *      Value will always throw suspense at least once - use with caution.
 *
 * @param factory - Callback run to derrive property value.
 * @param required - (default: true) Run factory immediately on creation, otherwise on access.
 */
function set <T> (factory: set.Factory<T> | Promise<T>, required: false): T | undefined;
function set <T> (factory: set.Factory<T> | Promise<T>, required?: boolean): T;

function set <T> (value: undefined, onUpdate: set.Callback<T>): T;
function set <T> (value: T, onUpdate: set.Callback<T>): T;

function set <T> (
  value?: set.Factory<T> | Promise<T> | T,
  argument?: set.Callback<any> | boolean){

  return add<T>((key, control) => {
    const { state, subject } = control;
    const output: Control.PropertyDescriptor = {};

    if(typeof value == "function" || value instanceof Promise){
      function init(){
        try {
          if(typeof value == "function")
            value = mayRetry(value.bind(subject, key, subject));

          if(value instanceof Promise){
            const pending = value
              .then(value => {
                output.get = undefined;
                state[key] = value;
                return value;
              })
              .catch(err => {
                output.get = () => { throw err };
              })
              .finally(() => {
                control.update(key);
              })

            if(argument !== false)
              return () => {
                const { message, stack } = Oops.NotReady(subject, key);
                throw assign(pending, { message, stack });
              }
          }
          else
            state[key] = value;
        }
        catch(err){
          Oops.ComputeFailed(subject, key).warn();
          throw err;
        }
      }

      if(argument)
        init();
      else
        output.get = () => {
          const get = output.get =
            key in state ? undefined : init();

          return get ? get() : state[key];
        }
    }
    else {
      const set = typeof argument == "function"
        ? createValueEffect(argument)
        : undefined;
  
      if(value !== undefined){
        state[key] = value;
        return { set };
      }

      if(set)
        output.set = function(this: any, value: any){
          output.set = set;
          state[key] = state[key];
          return set.call(this, value);
        }

      output.get = () => {
        if(key in state)
          return state[key];

        throw suspense(control, key);
      }
    }

    return output;
  })
}

export { set }