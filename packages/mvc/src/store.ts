import { CAUSE, REPORT } from './dispatch';
import { event, listener, Observer, observer, touch, unwrap, watch } from './observable';

type Key = Observer.Event;

type Config<T = any, S = any> = {
  value?: T;
  get?: ((source: S) => T) | boolean;
  set?: ((value: T, previous: T) => T | void) | boolean;
  enumerable?: boolean;
};

const define = Object.defineProperty;

const STORE = new WeakMap<object, Record<Key, unknown>>();

const STALE = new WeakSet<() => void>();

/** Receives values written through a managed accessor, for an owner to adopt. */
const HELD = {
  adopt(target: object, key: Key, value: unknown): void {}
};

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child states. */
let EXPORT: Map<any, any> | undefined;

function store(target: object) {
  let data = STORE.get(target);

  if (!data) STORE.set(target, (data = {}));

  return data;
}

function entries(target: object) {
  return Object.entries(store(target));
}

/** Manage own configurable values of an object - `_` keys and `then` stay plain. */
function manage(target: object) {
  for (const key in target) {
    const desc: PropertyDescriptor = Object.getOwnPropertyDescriptor(target, key) || {};

    if (!('value' in desc) || !desc.configurable) continue;

    if (key[0] == '_' || key == 'then') unmanaged(target, key, desc.value);
    else apply(target, key, desc, true);
  }
}

function unmanaged(target: object, key: string, value: unknown) {
  define(target, key, {
    configurable: true,
    enumerable: false,
    get: () => value,
    set: (next) => { value = next }
  });
}

/**
 * Define or update a managed property using a descriptor config.
 * If the property already is managed, config will only accept value.
 * If the property does not exist, it will be created and made reactive.
 *
 * @param silent - If an update does occur, listeners will not be refreshed automatically.
 */
function apply(target: object, key: string, config: Config, silent?: boolean) {
  const desc = Object.getOwnPropertyDescriptor(target, key);

  if (desc && 'get' in desc) {
    if (Object.keys(config).some((k) => k != 'value'))
      throw new Error(`Property ${key} on ${target} is already defined.`);
    if ('value' in config) update(target, key, config.value, silent);
    return;
  }

  function set(value: unknown, silent?: boolean) {
    update(target, key, value, silent, true);
  }

  define(target, key, {
    configurable: true,
    enumerable: config.enumerable !== false,
    get(this: object) {
      const value =
        typeof config.get == 'function'
          ? config.get(this)
          : access(target, key, config.get);

      return touch(this, key, value);
    },
    set(next: any, silent?: boolean) {
      if (config.set === false)
        throw new Error(`${target}.${String(key)} is read-only.`);

      if (typeof config.set == 'function')
        try {
          const output = config.set(next, store(target)[key]);
          if (output !== undefined) next = output;
        } catch (err: unknown) {
          if (err === false) return;
          if (err === true) {
            set(next, true);
            return;
          }
          throw err;
        }

      set(next, silent);
    }
  });

  if ('value' in config) set(config.value, silent);
}

/**
 * Install a reactive computed property, derived from `getter`.
 *
 * The getter is invoked with the tracking proxy as both `this` and its first argument;
 * reads of managed properties through it create subscriptions. Result is cached and
 * emits a keyed event when stale.
 */
function compute(this: object, getter: (self: any) => unknown, key: string) {
  const data = store(this);
  let reset: (() => void) | undefined;
  let isAsync: boolean;
  let suspended = false;
  let waiting: Promise<unknown> | undefined;
  let proxy: any;

  const connect = () => {
    reset = watch(
      this,
      (current) => {
        proxy = current;

        if (!(key in data) || STALE.delete(run)) run(!reset);

        return (didUpdate) => {
          if (didUpdate) {
            STALE.add(run);
            event(this, key, true);
          }
        };
      },
      false
    );
  };

  const run = (initial?: boolean) => {
    let next: unknown;

    waiting = undefined;

    try {
      next = getter.call(proxy, proxy);
    } catch (err) {
      if (err instanceof Promise) {
        if (initial) {
          suspended = true;
          throw err;
        }

        const retry = () => {
          if (waiting === err && observer(this) !== null) run();
        };

        waiting = err;
        err.then(retry, retry);

        if (suspended) return;
      } else if (initial) {
        console.warn(`An exception was thrown while initializing ${this}.${key}.`);
        throw err;
      } else REPORT.as('getter', this, err, key);
    }

    suspended = false;
    update(this, key, next, !isAsync);
  };

  apply(
    this,
    key,
    {
      enumerable: true,
      set: false,
      get: () => {
        if (!proxy) {
          if (observer(this) === null) return data[key];

          connect();
          isAsync = true;
        }

        if (STALE.delete(run)) run();

        return access(this, key, suspended);
      }
    },
    true
  );
}

/**
 * Read a managed value. Where required and not yet set, throws a promise
 * which resolves once it is - suspense.
 */
function access(target: object, property: string, required?: boolean) {
  const data = store(target);

  if (property in data || required === false) {
    const value = data[property];

    if (value !== undefined || !required) return value;
  }

  if (observer(target) === null) return undefined;

  const error = new Error(`${target}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    listener(target, (key) => {
      if (key === property) {
        resolve(data[key]);
        return null;
      }

      if (key === null) {
        reject(CAUSE.has(target) ? CAUSE.get(target) : new Error(`${target} is destroyed.`));
      }
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: 'Suspense',
    message: error.message,
    stack: error.stack
  });
}

/**
 * Update a managed value and notify listeners.
 *
 * A destroyed target stores the write without dispatch, reports it unless `silent`, and returns `false`.
 */
function update<T>(
  target: object,
  key: Key,
  value: T,
  silent?: boolean,
  own?: boolean
) {
  const data = store(target);

  value = unwrap(value);

  if (observer(target) === null) {
    if (!silent) REPORT.as('dead', target, new Error(`Tried to update ${target}.${String(key)} but state is destroyed.`), String(key));
    data[key] = value;
    return false;
  }

  if (key in data && value === data[key]) return false;

  data[key] = value;

  if (!silent) event(target, key);

  if (own) HELD.adopt(target, key, value);

  return true;
}

/** Export current values, drilling into any which implement `get()`. Recursive references reuse one export. */
function values(target: object) {
  const values = {} as any;
  let notRecursive;

  if (!EXPORT) {
    notRecursive = true;
    EXPORT = new Map();
  }

  EXPORT.set(target, values);

  for (let [key, value] of entries(target)) {
    if (EXPORT.has(value)) value = EXPORT.get(value);
    else if (
      value &&
      typeof value == 'object' &&
      'get' in value &&
      typeof value.get === 'function'
    )
      value = value.get();

    values[key] = value;
  }

  if (notRecursive) EXPORT = undefined;

  return Object.freeze(values);
}

export type { Config };
export { access, apply, compute, entries, HELD, manage, store, update, values };
