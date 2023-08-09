import { add, Control } from '../control';
import { assign } from '../helper/object';
import { attempt } from '../observe';

declare namespace set {
  type Callback<T, S = any> = (this: S, next: T, previous: T) =>
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
 * Run factory only if/when accessed. Value will be undefined until
 * factory resolves, which will also dispatch an update for the property.
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
 * Set a property with empty placeholder and update callback.
 * 
 * @param value - Starting value for property. If undefined, suspense will be thrown on access, until value is set and accepted by callback.
 * @param onUpdate - Callback run when property is set. If returns false, update is not accepted and property will keep previous value.
 */
function set <T> (value: T | undefined, onUpdate: set.Callback<T>): T;

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
            value = attempt(value.bind(subject, key, subject));

          if(value instanceof Promise){
            const pending = value
              .then(value => {
                output.get = undefined;
                control.update(key, value);
                return value;
              })
              .catch(err => {
                output.get = () => { throw err };
                control.update(key);
              })

            if(argument !== false)
              return output.get = () => {
                throw assign(pending, {
                  message: `${subject}.${key} is not yet available.`,
                  stack: new Error().stack
                });
              }
          }
          else 
            control.update(key, value);
        }
        catch(err){
          console.warn(`Generating initial value for ${subject}.${key} failed.`);
          throw err;
        }
      }

      if(argument)
        init();
      else
        output.get = () => {
          const get = key in state ? null : init();
          return get ? get() : state[key];
        }
    }
    else {
      if(value !== undefined)
        output.value = value;
      else
        output.get = control.fetch(key);

      if(typeof argument == "function"){
        let unSet: ((next: T) => void) | undefined;

        output.set = function(this: any, value: any, previous: any){
          const out = argument.call(this, value, previous);

          if(out === false)
            return out;

          if(typeof unSet == "function")
            unSet = void unSet(value);
      
          if(typeof out == "function")
            unSet = out;
        }
      }
    }

    return output;
  })
}

export { set }