import { event, touch } from '../observable';

const MAX_INDEX = 2 ** 32 - 2;

function index(key: string | symbol) {
  const value = typeof key == 'symbol' ? -1 : +key;
  return String(value) === key && value >= 0 && value <= MAX_INDEX ? value : -1;
}

/**
 * Wrap an array or object as a reactive Proxy.
 *
 * Reads register subscriptions in active watch contexts; writes fire keyed events.
 * Single-level only - nested objects are not wrapped recursively. Use a child State
 * (or a separate `hot()` call) for nested reactivity.
 *
 * Storage is shared with the input value: external mutation of the original
 * collection bypasses dispatch. Pass a fresh value when this matters.
 */
function hot<T>(value: T[]): T[];
function hot<T extends object>(value: T): T;
function hot(value: any) {
  if (value === null || typeof value !== 'object')
    throw new Error('hot() requires an array or object');

  const get = () => Object.freeze(Array.isArray(value) ? value.slice() : { ...value });

  const proxy: any = new Proxy(value, {
    get(target, key, receiver) {
      if (key === 'get' && !(key in target)) return get;
      const result = Reflect.get(target, key, receiver);
      if (typeof key === 'symbol' || typeof result === 'function') return result;
      return touch(receiver, key, result);
    },
    has(target, key) {
      return key === 'get' || key in target;
    },
    set(target, key, value) {
      const grows = Array.isArray(target) && index(key) >= target.length;
      const old = (target as any)[key];
      const ok = Reflect.set(target, key, value);
      if (ok && typeof key !== 'symbol') {
        if (old !== value) event(proxy, key);
        if (grows) event(proxy, 'length');
      }
      return ok;
    },
    deleteProperty(target, key) {
      if (!(key in target)) return true;
      const ok = Reflect.deleteProperty(target, key);
      if (ok && typeof key !== 'symbol') event(proxy, key);
      return ok;
    }
  });

  event(proxy);
  return proxy;
}

export { hot };
