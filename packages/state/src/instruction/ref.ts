import { listener, capture } from '../observable';
import { State, update } from '../state';
import { def } from './def';

const { defineProperty, defineProperties } = Object;

declare namespace ref {
  type Callback<T> = (
    argument: T
  ) => ((next: T | null) => void) | Promise<void> | void | boolean;

  interface Object<T = any> {
    /** Current value held by this reference. */
    current: T;

    /** State instance this reference belongs to. */
    is: State;

    /** Key of property on state this reference belongs to. */
    key: string;

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
  type Proxy<T extends State> = { [P in State.Field<T>]-?: Object<T[P]> } & {
    get(): T;
  };

  type CustomProxy<T extends State, R> = { [P in State.Field<T>]-?: R } & {
    get(): T;
  };
}

/**
 * Creates an object with references to all managed values.
 * Each property is a function to set value in state when invoked.
 *
 * *Properties are simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param state - Source state from which to reference values.
 */
function ref<T extends State>(state: T): ref.Proxy<T>;

/**
 * Creates an object with values based on managed values.
 * Each property will invoke map function on first access supply
 * the its return value going forward.
 *
 * @param state - Source state from which to reference values.
 * @param map - Function producing the placeholder value for any given property.
 */
function ref<T extends State, R>(
  state: T,
  map: (key: State.Field<T>) => R
): ref.CustomProxy<T, R>;

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
function ref<T>(callback?: ref.Callback<T>): ref.Object<T>;

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 * @param ignoreNull - Default `true`. If `false`, will still callback with `null`.
 */
function ref<T>(
  callback: ref.Callback<T | null>,
  ignoreNull: boolean
): ref.Object<T>;

function ref<T>(
  arg?: ref.Callback<T> | State,
  arg2?: ((key: string) => any) | boolean
) {
  if (arg instanceof State)
    return customProxy(arg, arg2 as ((key: string) => any) | undefined);

  if (typeof arg == 'object')
    throw new Error('ref instruction requires a State instance, got a plain object');

  return property(arg, arg2 as boolean | undefined);
}

function customProxy(
  target: State,
  map?: (key: string) => any
) {
  return def((_key, subject) => {
    const value = {} as Record<string, any>;
    const source = target as any as Record<string, any>;

    listener(target, () => {
      for (const key in source)
        if (map)
          defineProperty(value, key, {
            configurable: true,
            get() {
              const out = map(key);
              defineProperty(value, key, { value: out });
              return out;
            }
          });
        else {
          const set = (x: any) => (source[key] = x);
          const get = (cb?: (value: any) => void) =>
            cb ? listener(subject, () => cb(source[key]), key) : source[key];

          defineProperties(set, {
            current: { get, set },
            get: { value: get },
            is: { value: target },
            key: { value: key }
          });

          defineProperty(value, key, { value: set });
        }

      return null;
    });

    return {
      get: () => value
    };
  });
}

function property<T>(
  callback?: ref.Callback<T>,
  ignoreNull?: boolean
) {
  return def((key, subject, state) => {
    let unset: ((next: T) => void) | undefined;

    function get(cb?: (value: T) => void) {
      return cb
        ? listener(subject, () => cb(state[key]), key)
        : state[key];
    }

    function set(value?: any) {
      if (!update(subject, key, value) || !callback) return;
      if (unset) unset = void unset(value);
      if (value === null && ignoreNull !== false) return;

      capture((release) => {
        const out = callback.call(subject, value);

        unset = (next) => {
          if (typeof out == 'function') out(next);
          release();
        };
      });
    }

    state[key] = null;

    const ref = { get, key, is: subject };

    defineProperty(ref, 'current', { get, set });

    return {
      get: () => ref
    };
  });
}

export { ref };
