import { addListener, context } from '../control';
import { Model, event, update } from '../model';
import { use } from './use';

declare namespace set {
  type Callback<T, S = any> = (this: S, next: T, previous: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;

  type Factory<T, S = any> = (this: S, key: string) => Promise<T> | T;
}

/**
 * Set property as `undefined` but required.
 * 
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (aka: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 */
function set <T = any>(): T;

/**
 * Set property with a factory function.
 * 
 * **Note** Factory is lazy! It will only run if/when property is accessed.
 * Value will be undefined until factory resolves, which will also dispatch an update for the property.
 */
function set <T> (factory: set.Factory<T> | Promise<T>, required: false): T | undefined;

/**
 * Set property with a factory function.
 *
 * If async, property cannot be accessed until resolves, yeilding a result.
 * If accessed while still processing, React Suspense will be thrown.
 *
 * @param factory - Callback run to derrive property value.
 * @param required - If true run factory immediately on creation, otherwise on access.
 */
function set <T> (factory: set.Factory<T> | Promise<T>, required?: boolean): T;

/**
 * Set property with a factory function.
 *
 * If async, property cannot be accessed until resolves, yeilding a result.
 * If accessed while still processing, React Suspense will be thrown.
 *
 * @param factory - Callback run to derrive property value.
 * @param onUpdate - Callback run when property is finished computing or is set. 
 */
function set <T> (factory: set.Factory<T> | Promise<T>, onUpdate?: set.Callback<T>): T;

/**
 * Set a property with empty placeholder and/or update callback.
 * 
 * @param value - Starting value for property. If undefined, suspense will be thrown on access, until value is set and accepted by callback.
 * @param onUpdate - Callback run when property is set. If returns false, update is not accepted and property will keep previous value.
 */
function set <T> (value: T | undefined, onUpdate?: set.Callback<T>): T;

function set <T> (
  value?: set.Factory<T> | Promise<T> | T,
  argument?: set.Callback<any> | boolean){

  return use<T>((key, subject) => {
    const property: Model.Descriptor = { enumerable: false };

    if(typeof value == "function" || value instanceof Promise){
      function init(){
        if(typeof value == "function")
          try {
            value = attempt(value.bind(subject, key));
          }
          catch(err){
            console.warn(`Generating initial value for ${subject}.${key} failed.`);
            throw err;
          }

        property.get = argument !== false;

        const set = (value: any) => subject[key] = value;

        if(value instanceof Promise)
          value.then(set, error => {
            event(subject, key);
            property.get = () => { throw error };
          })
        else
          set(value);

        if(argument)
          return null;
        
        return subject[key];
      }

      if(argument)
        addListener(subject, init, true);
      else
        property.get = init;
    }
    else if(value !== undefined)
      property.value = value;

    if(typeof argument == "function"){
      let unset: ((next: T) => void) | undefined;

      property.set = function(this: any, value: any, previous: any){
        const ctx = context();
        const out = argument.call(this, value, previous);
        const flush = ctx();

        if(out === false)
          return out;

        if(typeof unset == "function")
          unset(value);

        unset = (next: T) => {
          if(typeof out == "function")
            out(next);

          flush();
        }
      }
    }
    else
      property.set = value => {
        property.get = undefined;
        update(subject, key, value);
      }

    return property;
  })
}

function attempt(fn: () => any): any {
  function retry(err: unknown){
    if(err instanceof Promise)
      return err.then(compute);
    else
      throw err;
  }

  function compute(): any {
    try {
      const output = fn();

      return output instanceof Promise
        ? output.catch(retry)
        : output;
    }
    catch(err){
      return retry(err);
    }
  }

  return compute();
}

export { set }