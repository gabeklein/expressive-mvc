import { listener, capture } from '../observable';
import { Model } from '../model';
import { update } from '../store';
import { def } from './def';

const { defineProperty, defineProperties } = Object;

declare namespace ref {
  /** Builds the value for one key of a mapped proxy - `this` is the source instance. */
  type Map<T extends Model, R> = (
    this: T,
    key: Model.Field<T> & string,
    state: T
  ) => R;

  /**
   * Runs as a new value is set, `this` the instance.
   *
   * Return a function to receive the next value as this one is replaced.
   */
  type Callback<T> = (
    argument: T
  ) => ((next: T | null) => void) | Promise<void> | void | boolean;

  /** Callable ref that also exposes ref-object properties. */
  interface Object<T = any> {
    /** Sets the value - same as assigning `current`. */
    (value: T | null): void;

    /** Value held - reading does not subscribe; writing dispatches an update for `key`. */
    current: T;

    /** Instance this reference belongs to. */
    is: Model;

    /** Property on `is` this reference belongs to. */
    key: string;

    /**
     * Calls back with the new value after each update to `key`; returns unsubscribe.
     *
     * Not called for the current value.
     */
    get(callback: (value: T) => void): () => void;

    /** Value held - `null` until set; does not subscribe. */
    get(): T | null;
  }

  /** A ref-object per enumerable field of `T`. */
  type Proxy<T extends Model> = { [P in Model.Field<T>]-?: Object<T[P]> } & {
    get(): T;
  };

  /** A mapped value per enumerable field of `T`. */
  type CustomProxy<T extends Model, R> = { [P in Model.Field<T>]-?: R } & {
    get(): T;
  };
}

/**
 * Object with a ref-object for each field of an instance - `.current` reads and writes the field.
 *
 * Keys are the instance's enumerable fields as it activates - computed getters included, read-only;
 * `ref` and `set` fields excluded. Keys are non-enumerable on the proxy. Throws on a plain object.
 * Non-enumerable; excluded from snapshots.
 *
 * @example
 * name = '';
 * email = '';
 * fields = ref(this);
 */
function ref<T extends Model>(state: T): ref.Proxy<T>;

/**
 * Object with a mapped value for each field of an instance, built on first access.
 *
 * Map runs once per key, `this` the instance; the result is cached. Keys as for `ref(state)`.
 * Non-enumerable; excluded from snapshots.
 *
 * @example
 * name = '';
 * inputs = ref(this, (key) => createInput(key));
 */
function ref<T extends Model, R>(
  state: T,
  map: ref.Map<T, R>
): ref.CustomProxy<T, R>;

/**
 * Mutable reference - call it, or assign `.current`, to set; `null` until set.
 *
 * Writes dispatch an update like any field; reading `.current` does not subscribe.
 * The value appears in snapshots; the field itself is non-enumerable.
 * Callback runs synchronously per new value, skipping `null` - an identical value is ignored.
 * A function it returns runs with the next value as this one is replaced, `null` included;
 * effects created in the callback stop then too.
 *
 * @example
 * element = ref<HTMLDivElement>((el) => {
 *   const observer = new ResizeObserver(() => this.measure());
 *   observer.observe(el);
 *   return () => observer.disconnect();
 * });
 */
function ref<T>(callback?: ref.Callback<T>): ref.Object<T>;

/**
 * Mutable reference whose callback also runs for `null` when `ignoreNull` is `false`.
 *
 * Otherwise as `ref(callback)`.
 */
function ref<T>(
  callback: ref.Callback<T | null>,
  ignoreNull: boolean
): ref.Object<T>;

function ref<T extends Model>(
  arg?: ref.Callback<T> | T,
  arg2?: ref.Map<T, any> | boolean
) {
  if (arg instanceof Model)
    return proxy(arg, arg2 as ref.Map<T, any> | undefined);

  if (typeof arg == 'object')
    throw new Error(
      'ref instruction requires a Model instance, got a plain object'
    );

  return property(arg, arg2 as boolean | undefined);
}

function defaultMap(this: Model, key: string) {
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

function proxy(target: Model, map: ref.Map<any, any> = defaultMap) {
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
