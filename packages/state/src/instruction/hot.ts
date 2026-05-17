import { event, touch } from '../observable';

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
  if (typeof value !== 'object' || !value)
    throw new Error('hot() requires an array or object');

  return Array.isArray(value) ? array(value) : object(value);
}

const MAX_INDEX = 2 ** 32 - 2;

function index(key: string | symbol) {
  const value = typeof key == 'symbol' ? -1 : +key;
  return String(value) === key && value >= 0 && value <= MAX_INDEX ? value : -1;
}

function offset(value: number | undefined, fallback: number, length: number) {
  if (value === undefined) return fallback;
  const number = Number(value);
  value = !number ? 0 : Number.isFinite(number) ? Math.trunc(number) : number;

  return Math.min(Math.max(value < 0 ? length + value : value, 0), length);
}

function array<T>(value: T[]) {
  const get = () => Object.freeze(value.slice());

  const proxy: any = new Proxy(value, {
    has,
    get(target: T[], key, receiver) {
      if (key === 'get') return get;

      const result = Reflect.get(target, key, receiver);

      if (typeof key === 'symbol') return result;
      if (typeof result !== 'function') return touch(receiver, key, result);

      if (key === 'slice')
        return function slice(this: unknown, start?: number, end?: number) {
          const length = touch(receiver, 'length', target.length);
          const from = offset(start, 0, length);
          const to = offset(end, length, length);

          for (let i = from; i < to; i++) touch(receiver, String(i));

          return result.call(receiver, start, end);
        };

      if (key === 'some')
        return function some(
          this: unknown,
          callback: (value: unknown, index: number, array: unknown[]) => unknown,
          thisArg?: unknown
        ) {
          const length = touch(receiver, 'length', target.length);

          for (let i = 0; i < length; i++) {
            touch(receiver, String(i));
            if (i in target && callback.call(thisArg, receiver[i], i, receiver))
              return true;
          }

          return false;
        };

      return result;
    },
    set(target: T[], key, value) {
      const grows = index(key) >= target.length;
      const ok = assign(proxy, target, key, value);
      if (ok && grows && typeof key !== 'symbol') event(proxy, 'length');
      return ok;
    },
    deleteProperty(target, key) {
      return remove(proxy, target, key);
    }
  });

  event(proxy);
  return proxy;
}

function object<T extends object>(value: T) {
  const get = () => Object.freeze({ ...value });

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
      return assign(proxy, target, key, value);
    },
    deleteProperty(target, key) {
      return remove(proxy, target, key);
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
