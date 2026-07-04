import { event, KEYS, touch } from '../observable';

/**
 * Wrap an array or object as a reactive Proxy.
 *
 * Reads register subscriptions in active watch contexts; writes fire keyed events.
 * Key enumeration is shape-reactive: add/delete of object keys re-fires consumers
 * which enumerated, while existing-key writes stay tracked per key.
 * Single-level only - nested objects are not wrapped recursively. Use a child State
 * (or a separate `hot()` call) for nested reactivity.
 *
 * Storage is shared with the input value: external mutation of the original
 * collection bypasses dispatch. Pass a fresh value when this matters.
 */
function hot<T>(value: T[]): T[];
function hot<T extends object>(value: T): T;
function hot(value: any) {
  if (typeof value !== 'object' || !value)
    throw new Error('hot() requires an array or object');

  return Array.isArray(value) ? array(value) : object(value);
}

const MAX_INDEX = 2 ** 32 - 2;
const DELETES = new Set(['pop', 'shift', 'splice']);

function array<T>(value: T[]) {
  function index(key: string | symbol) {
    const value = typeof key == 'symbol' ? -1 : +key;
    return String(value) === key && value >= 0 && value <= MAX_INDEX ? value : -1;
  }

  function deny() {
    throw new Error(
      'hot() arrays must be dense. Use undefined/null placeholders or splice().'
    );
  }

  for (let i = 0; i < value.length; i++)
    if (!(i in value)) deny();

  const get = () => Object.freeze(value.slice());
  let internal = false;

  const proxy: any = new Proxy(value, {
    has,
    get(target: T[], key, receiver) {
      if (key === 'get') return get;

      const result = Reflect.get(target, key, receiver);

      if (typeof key === 'symbol') return result;
      if (typeof result === 'function')
        return DELETES.has(key) ? (...args: unknown[]) => {
          internal = true;

          try {
            return result.apply(receiver, args);
          } finally {
            internal = false;
          }
        } : result;

      return touch(receiver, key, result);
    },
    set(target: T[], key, value) {
      const oldLength = target.length;
      if (key === 'length' && value > oldLength) deny();

      const grows = index(key) >= target.length;
      if (grows && index(key) > target.length) deny();

      const ok = assign(proxy, target, key, value);
      if (ok && grows && typeof key !== 'symbol') event(proxy, 'length');
      if (ok && key === 'length')
        for (let i = target.length; i < oldLength; i++) event(proxy, String(i));

      return ok;
    },
    deleteProperty(target, key) {
      if (!(key in target)) return true;
      if (index(key) >= 0 && !internal) deny();

      return remove(proxy, target, key);
    }
  });

  event(proxy);
  return proxy;
}

function object<T extends object>(value: T) {
  const get = () => Object.freeze({ ...value });
  const notify = (key: unknown) => typeof key !== 'symbol' && event(proxy, KEYS);

  const proxy: any = new Proxy(value, {
    has,
    get(target, key, receiver) {
      if (key === 'get' && !(key in target)) return get;

      const result = Reflect.get(target, key, receiver);

      if (typeof key === 'symbol' || typeof result === 'function')
        return result;

      return touch(receiver, key, result);
    },
    set(target, key, value) {
      const had = key in target;
      const ok = assign(proxy, target, key, value);

      if (ok && !had) notify(key);

      return ok;
    },
    deleteProperty(target, key) {
      const had = key in target;
      const ok = remove(proxy, target, key);

      if (ok && had) notify(key);

      return ok;
    }
  });

  event(proxy);
  return proxy;
}

function has(target: object, key: string | symbol) {
  return key === 'get' || key in target;
}

function assign(proxy: object, target: object, key: string | symbol, value: any) {
  const old = (target as any)[key];
  const ok = Reflect.set(target, key, value);

  if (ok && typeof key !== 'symbol' && old !== value) event(proxy, key);

  return ok;
}

function remove(proxy: object, target: object, key: string | symbol) {
  if (!(key in target)) return true;

  const ok = Reflect.deleteProperty(target, key);
  if (ok && typeof key !== 'symbol') event(proxy, key);

  return ok;
}

export { hot };
