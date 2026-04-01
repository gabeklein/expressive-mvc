import {
  event,
  emit,
  observable,
  observing,
  listener,
  Observable
} from './observable';

const define = Object.defineProperty;

/** Internal state assigned to stateful objects. */
const STORE = new WeakMap<
  Stateful,
  Record<string | number | symbol, unknown>
>();

type Activate = (() => void) | void;

declare namespace Stateful {
  type Apply<T = any> = {
    value?: T;
    get?: ((source: Stateful) => T) | boolean;
    set?: ((value: T, previous: T) => T | void) | boolean;
    enumerable?: boolean;
  };
}

interface Stateful extends Observable {
  [Stateful]?(store: Record<string, unknown>, ...args: any[]): Activate;
}

const Stateful = Symbol('Stateful');

/**
 * Make any object stateful - reactive properties with get/set descriptors.
 * If object has a [Stateful] method, calls it with the store and registers
 * the returned activate function to run on first event.
 */
function stateful<T extends Stateful>(target: T): T {
  const store: Record<string | number | symbol, unknown> = {};
  STORE.set(target, store);

  let activate: Activate;

  if (Stateful in target) activate = (target[Stateful] as Function)(store);

  listener(target, () => {
    for (const key in target) {
      const desc = Object.getOwnPropertyDescriptor(target, key)!;
      if ('value' in desc) apply(target, key, desc, true);
    }

    if (activate) activate();

    return null;
  });

  return target;
}

/**
 * Define or update a managed property using a descriptor config.
 * If the property already is managed, config will only accept value.
 * If the property does not exist, it will be created and made reactive.
 */
function apply(
  target: Stateful,
  key: string | number,
  config: Stateful.Apply,
  silent?: boolean
) {
  const desc = Object.getOwnPropertyDescriptor(target, key);

  if (desc && 'get' in desc) {
    if (Object.keys(config).some((k) => k != 'value'))
      throw new Error(`Property ${key} on ${target} is already defined.`);
    if ('value' in config) update(target, key, config.value, silent);
    return;
  }

  function set(value: unknown, silent?: boolean) {
    update(target, key, value, silent);
  }

  define(target, key, {
    configurable: true,
    enumerable: config.enumerable !== false,
    get() {
      return observing(
        this,
        key,
        typeof config.get == 'function'
          ? config.get(this)
          : access(target, key as string, config.get)
      );
    },
    set(next: any, silent?: boolean) {
      if (config.set === false)
        throw new Error(`${target}.${String(key)} is read-only.`);

      if (typeof config.set == 'function')
        try {
          const output = config.set(next, STORE.get(target)![key]);
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

function update(
  target: Stateful,
  key: string | number | symbol,
  value: unknown,
  silent?: boolean
) {
  if (observable(target) === null) {
    if (silent) return false;
    throw new Error(
      `Tried to update ${target}.${String(key)} but state is destroyed.`
    );
  }

  const store = STORE.get(target)!;

  if (key in store && value === store[key]) return false;

  store[key] = value;

  if (!silent) event(target, key);

  return true;
}

function access(target: Stateful, property: string, required?: boolean) {
  const store = STORE.get(target)!;

  if (property in store || required === false) {
    const value = store[property];
    if (value !== undefined || !required) return value;
  }
}

function values(target: Stateful) {
  const store = STORE.get(target)!;
  const result = {} as any;

  for (const [key, value] of Object.entries(store)) result[key] = value;

  return Object.freeze(result);
}

function assign(
  target: Stateful,
  data: Record<string, unknown>,
  silent?: boolean
) {
  emit(target, true);

  for (const key in data) {
    if (!(key in target)) continue;

    const desc = Object.getOwnPropertyDescriptor(target, key)!;
    const set = desc && (desc.set as (value: any, silent?: boolean) => void);

    if (set) set.call(target, data[key], silent);
    else (target as any)[key] = data[key];
  }
}

export { Stateful, STORE, apply, update, access, values, assign, stateful };
