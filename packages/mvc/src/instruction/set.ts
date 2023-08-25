import { Control } from '../control';
import { add } from '../model';
import { attempt } from './run';

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
    const output: Control.Descriptor = {};

    if(typeof value == "function" || value instanceof Promise){
      function init(){
        if(typeof value == "function")
          try {
            value = attempt(value.bind(subject, key, subject));
          }
          catch(err){
            console.warn(`Generating initial value for ${subject}.${key} failed.`);
            throw err;
          }

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

          Object.assign(pending, {
            message: `${subject}.${key} is not yet available.`,
            stack: new Error().stack
          });

          return () => {
            if(argument !== false)
              throw pending;
          };
        }

        control.update(key, value);
      }

      output.get = argument ? init() : () => {
        const get = key in state ? null : init();
        return get ? get() : state[key];
      };
    }
    else {
      if(value === undefined)
        output.get = fetch(control, key);
      else
        output.value = value;

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

function fetch(self: Control, property: string, required?: boolean){
  const { subject, state } = self;
  
  return () => {
    if(property in state || required === false){
      const value = state[property];

      if(value !== undefined || !required)
        return value;
    }

    const error = new Error(`${subject}.${property} is not yet available.`);
    const promise = new Promise<void>((resolve, reject) => {
      function release(){
        remove();
        resolve();
      }
  
      const remove = self.addListener(key => {
        if(key === property)
          return release;
  
        if(key === null)
          reject(new Error(`${subject} is destroyed.`));
      });
    });
  
    throw Object.assign(promise, {
      toString: () => String(error),
      name: "Suspense",
      message: error.message,
      stack: error.stack
    });
  }
}

export { fetch, set }