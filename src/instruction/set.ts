import { Control } from '../control';
import { createValueEffect } from '../effect';
import { issues } from '../helper/issues';
import { assign } from '../helper/object';
import { mayRetry, suspend } from '../suspense';
import { add } from './add';

export const Oops = issues({
  ComputeFailed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
});

declare namespace set {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;

  type Factory<T, S = unknown> = (this: S, key: string, thisArg: S) => T;
}

/**
 * Set property with a placeholder.
 * 
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (ala: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 */
function set <T = any>(): T;

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

function set <T> (factory: Promise<T>, required: false): T | undefined;
function set <T> (factory: Promise<T>, required?: boolean): T;

function set <T> (value: undefined, onUpdate: set.Callback<T>): T;
function set <T, S> (value: undefined, onUpdate: set.Callback<T, S>): T;

function set <T> (value: T, onUpdate: set.Callback<T>): T;
function set <T, S> (value: T, onUpdate: set.Callback<T, S>): T;

function set <T> (
  value?: set.Factory<T | Promise<T>> | Promise<T> | T,
  argument?: set.Callback<any> | boolean): any {

  return add(
    function set(key){
      const { state, subject } = this;
      
      if(typeof value == "function" || value instanceof Promise){
        const factoryRequired = argument !== false;
        let getter: () => any;
  
        const init = () => {
          try {
            if(typeof value == "function")
              value = mayRetry(value.bind(subject, key, subject));
  
            getter = factoryMode(this, value, key, factoryRequired);
          }
          catch(err){
            Oops.ComputeFailed(subject, key).warn();
            throw err;
          }
        }

        if(argument === true)
          init();
  
        return () => {
          if(!getter)
            init();
  
          return getter();
        }
      }

      if(value !== undefined)
        state.set(key, value);

      return {
        get: () => {
          if(state.has(key))
            return state.get(key);
          else
            throw suspend(this, key);
        },
        set: typeof argument == "function"
          ? createValueEffect(argument)
          : undefined
      }
    }
  )
}

export function factoryMode<T>(
  self: Control,
  value: Promise<T> | T,
  key: string,
  required: boolean
){
  const { subject, state } = self;

  let pending: Promise<any> | undefined;
  let error: any;

  if(value instanceof Promise){
    state.set(key, undefined);

    pending = value
      .catch(err => error = err)
      .then(val => {
        state.set(key, val);
        return val;
      })
      .finally(() => {
        pending = undefined;
        self.update(key);
      })
  }
  else
    state.set(key, value);

  const suspend = () => {
    if(required === false)
      return undefined;

    const issue = Oops.NotReady(subject, key);

    assign(pending!, {
      message: issue.message,
      stack: issue.stack
    });

    throw pending;
  }
  
  return (): T | undefined => {
    if(error)
      throw error;

    if(pending)
      return suspend();

    if(state.has(key))
      return state.get(key);
  }
}

export { set }