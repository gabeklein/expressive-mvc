import { addListener, context } from '../control';
import { Model, update } from '../model';
import { use } from './use';

const { defineProperty, defineProperties } = Object;

declare namespace ref {
  type Callback<T> = (argument: T) =>
    ((next: T | null) => void) | Promise<void> | void | boolean;

  interface Object<T = any> {
    (next: T | null): void;

    /** Current value held by this reference. */
    current: T | null;

    /** 
     * Subscribe to changes of this reference.
     * 
     * @param callback - Callback to invoke with the current value when it changes.
     * @returns Unsubscribe function to stop listening to changes.
     */
    get(callback: (value: T) => void): () => void;

    /** Retrieve current value. */
    get(): T | null;
  }

  /** Object with references to all managed values of `T`. */

  /** Object with references to all managed values of `T`. */
  type Proxy<T extends Model> =
    & { [P in Model.Field<T>]-?: Object<T[P]> }
    & { get(): T };

  type CustomProxy<T extends Model, R> =
    & { [P in Model.Field<T>]-?: R }
    & { get(): T };
}

/**
 * Creates an object with references to all managed values.
 * Each property is a function to set value in state when invoked.
 *
 * *Properties are simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param target - Source model from which to reference values.
 */
function ref <T extends Model> (target: T): ref.Proxy<T>;

/**
 * Creates an object with values based on managed values.
 * Each property will invoke mapper function on first access supply
 * the its return value going forward.
 *
 * @param target - Source model from which to reference values.
 * @param mapper - Function producing the placeholder value for any given property.
 */
function ref <O extends Model, R>
  (target: O, mapper: (key: Model.Field<O>) => R): ref.CustomProxy<O, R>;

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
function ref <T> (callback?: ref.Callback<T>): ref.Object<T>;

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 * @param ignoreNull - Default `true`. If `false`, will still callback with `null`.
 */
function ref <T> (callback: ref.Callback<T | null>, ignoreNull: boolean): ref.Object<T>;

function ref<T>(
  arg?: ref.Callback<T> | Model,
  arg2?: ((key: string) => any) | boolean){

  return use<T>((key, subject, state) => {
    let value = {};
    const method = (key: string) =>
      (callback?: (value: T) => void) => callback
        ? addListener(subject, () => callback(state[key]), key)
        : state[key];

    if(arg === subject)
      subject.get(() => {
        for(const key in state)
          if(typeof arg2 == "function")
            defineProperty(value, key, {
              configurable: true,
              get(){
                const out = arg2(key);
                defineProperty(value, key, { value: out });
                return out;
              }
            })
          else {
            const get = method(key);
            const set = (value: unknown) => {
              update(subject, key, value)
            };

            defineProperties(set, {
              current: { get, set },
              get: { value: get }
            });

            defineProperty(value, key, { value: set });
          }
      })

    else if(typeof arg == "object")
      throw new Error("ref instruction does not support object which is not 'this'");

    else {
      let unset: ((next: T) => void) | undefined;

      const get = method(key);
      const set = (value?: any) => {
        if(!update(subject, key, value) || !arg)
          return;

        if(unset)
          unset = void unset(value);
    
        if(value === null && arg2 !== false)
          return;

        const ctx = context();
        const out = arg.call(subject, value);
        const flush = ctx();

        unset = key => {
          if(typeof out == "function")
            out(key);

          flush();
        }
      };
  
      state[key] = null;
      value = defineProperties(set, {
        current: { get, set },
        get: { value: get }
      }) as ref.Object<T>;
    }

    defineProperty(subject, key, { value });
  })
}

export { ref }