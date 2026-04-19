import { listener, capture } from '../observable';
import { State, update } from '../state';
import { def } from './def';

const { defineProperty, defineProperties } = Object;

declare namespace ref {
  type Map<T extends State, R> = (
    this: T,
    key: State.Field<T> & string,
    state: T
  ) => R;

  type Callback<T> = (
    argument: T
  ) => ((next: T | null) => void) | Promise<void> | void | boolean;

  /** Callable ref that also exposes ref-object properties. */
  interface Object<T = any> {
    /** Set the current value of this reference. */
    (value: T | null): void;

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
 * Non-enumerable; excluded from snapshots and `ref(this)`.
 *
 * @param state - Source state from which to reference values.
 */
function ref<T extends State>(state: T): ref.Proxy<T>;

/**
 * Creates an object with values based on managed values.
 * Each property will invoke map function on first access supply
 * the its return value going forward.
 *
 * Non-enumerable; excluded from snapshots and `ref(this)`.
 *
 * @param state - Source state from which to reference values.
 * @param map - Function producing the placeholder value for any given property.
 */
function ref<T extends State, R>(
  state: T,
  map: ref.Map<T, R>
): ref.CustomProxy<T, R>;

/**
 * Creates a ref-compatible property.
 * Callable to set the value, with ref-object properties for reading and subscribing.
 *
 * Non-enumerable; excluded from snapshots and `ref(this)`.
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
function ref<T>(callback?: ref.Callback<T>): ref.Object<T>;

/**
 * Creates a ref-compatible property.
 * Callable to set the value, with ref-object properties for reading and subscribing.
 *
 * Non-enumerable; excluded from snapshots and `ref(this)`.
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 * @param ignoreNull - Default `true`. If `false`, will still callback with `null`.
 */
function ref<T>(
  callback: ref.Callback<T | null>,
  ignoreNull: boolean
): ref.Object<T>;

function ref<T extends State>(
  arg?: ref.Callback<T> | T,
  arg2?: ref.Map<T, any> | boolean
) {
  if (arg instanceof State)
    return proxy(arg, arg2 as ref.Map<T, any> | undefined);

  if (typeof arg == 'object')
    throw new Error(
      'ref instruction requires a State instance, got a plain object'
    );

  return property(arg, arg2 as boolean | undefined);
}

function defaultMap(this: State, key: string) {
  const source = this as any as Record<string, any>;
  const set = (x: any) => (source[key] = x);
  const get = (cb?: (value: any) => void) =>
    cb ? listener(this, () => cb(source[key]), key) : source[key];

  defineProperties(set, {
    current: { get, set },
    get: { value: get },
    is: { value: this },
    key: { value: key }
  });

  return set;
}

function proxy(target: State, map: ref.Map<any, any> = defaultMap) {
  return def((_key, _subject) => {
    const value = {} as Record<string, any>;
    const source = target as any as Record<string, any>;

    listener(target, () => {
      for (const key in source)
        defineProperty(value, key, {
          configurable: true,
          get() {
            const out = map.call(target, key, target);
            defineProperty(value, key, { value: out });
            return out;
          }
        });

      return null;
    });

    return {
      get: () => value,
      enumerable: false
    };
  });
}

function property<T>(callback?: ref.Callback<T>, ignoreNull?: boolean) {
  return def((key, subject, state) => {
    let unset: ((next: T) => void) | undefined;

    function get(cb?: (value: T) => void) {
      return cb ? listener(subject, () => cb(state[key]), key) : state[key];
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

    defineProperties(set, {
      current: { get, set },
      get: { value: get },
      is: { value: subject },
      key: { value: key }
    });

    return {
      get: () => set,
      enumerable: false
    };
  });
}

export { ref };
