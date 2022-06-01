import { apply } from './apply';
import { issues } from '../issues';
import { createValueEffect } from '../util';
import { mayRetry } from '../suspense';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  Failed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`
})

declare namespace set {
  type Factory<T, S = unknown> = (this: S, key: string, subject: S) => T;

  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;
}

/**
 * Set property with a placeholder.
 * 
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (ala: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 */
function set <T = any>(): T;

 /**
  * Set property with starting value `undefined`.
  * 
  * If required and accessed while still empty, React Suspense will be thrown.
  * Property will reject any assignment of undefined.
  * 
  * @param value - Starting value of host property (undefined).
  * @param required - Property will suspend callee if undefined at time of access.
  */
function set <T> (value: undefined, required: false): T | undefined;
function set <T> (value: undefined, required?: boolean): T;

function set <T> (value: undefined, onUpdate: set.Callback<T>): T | undefined;
function set <T, S> (value: undefined, onUpdate: set.Callback<T, S>): T | undefined;

 /**
  * Set property with an async function.
  * 
  * Property cannot be accessed until factory resolves, yeilding a result.
  * If accessed while processing, React Suspense will be thrown.
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
function set <T> (factory: set.Factory<Promise<T>>, required: false): T | undefined;
function set <T, S> (factory: set.Factory<Promise<T>, S>, required: false): T | undefined;

function set <T> (factory: set.Factory<Promise<T>>, required?: boolean): T;
function set <T, S> (factory: set.Factory<Promise<T>, S>, required?: boolean): T;

function set <T> (value: set.Factory<Promise<T>>, onUpdate: set.Callback<T>): T;
function set <T, S> (value: set.Factory<Promise<T>, S>, onUpdate: set.Callback<T, S>): T;

 /**
  * Set property with a factory function.
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
function set <T>(factory: set.Factory<T>, required: false): T | undefined;
function set <T, S>(factory: set.Factory<T, S>, required: false): T | undefined;

function set <T>(factory: set.Factory<T>, required?: boolean): T;
function set <T, S>(factory: set.Factory<T, S>, required?: boolean): T;

function set <T> (value: set.Factory<T>, onUpdate: set.Callback<T>): T;
function set <T, S> (value: set.Factory<T, S>, onUpdate: set.Callback<T, S>): T;

/**
 * Assign a property with result of a promise.
 */
function set <T> (factory: Promise<T>, required: false): T | undefined;
function set <T> (factory: Promise<T>, required?: boolean): T;
function set <T> (value: Promise<T>, onUpdate: set.Callback<T>): T;

/**
 * Assign a property.
 */
function set <T> (factory: T, required: false): T | undefined;
function set <T> (factory: T, required?: boolean): T;
function set <T> (value: T, onUpdate: set.Callback<T>): T;

function set(
  factory?: any,
  argument?: set.Callback<any> | boolean): any {  

  return apply(
    function set(key){
      const { subject, state } = this;
      const required =
        argument === true || argument === undefined;

      let set;
      let get: (() => void) | undefined;
      let suspense: boolean | undefined;

      if(factory === undefined)
        suspense = true;

      else {
        let pending: Promise<any> | undefined;
        let error: any;

        const init = () => {
          const output = typeof factory == "function" ?
            mayRetry(() => factory.call(subject, key, subject)) :
            factory;

          if(output instanceof Promise){
            pending = output
              .catch(err => error = err)
              .then(val => state[key] = val)
              .finally(() => {
                pending = undefined;
                this.update(key);
              })

            return;
          }

          return state[key] = output;
        }

        const suspend = () => {
          if(required === false)
            return undefined;

          const issue =
            Oops.NotReady(subject, key);

          Object.assign(pending, {
            message: issue.message,
            stack: issue.stack
          });

          throw pending;
        }

        if(required)
          try {
            init();
          }
          catch(err){
            Oops.Failed(subject, key).warn();
            throw err;
          }

        get = () => {
          if(pending)
            return suspend();

          if(error)
            throw error;

          if(key in state)
            return state[key];

          let output = init();

          return pending
            ? suspend()
            : output;
        }
      }

      if(typeof argument == "function")
        set = createValueEffect(argument);
      else
        set = (value: any) => {
          if(value === undefined && required)
            throw Oops.NonOptional(subject, key);
        }

      return {
        set,
        get,
        suspense
      }
    }
  )
}

export { set }