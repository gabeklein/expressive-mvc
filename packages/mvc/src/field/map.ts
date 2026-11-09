import { join } from '../context';
import { def } from './def';
import { element } from '../element';
import { event, listener, touch } from '../observable';
import { Model, parent } from '../model';

const SHAPE = Symbol('shape');
const KEYED = (_key: unknown, value: unknown) => value;

const MAKE = new WeakMap<object, Function>();
const OWNED = new WeakMap<object, Map<unknown, () => void>>();

const MAP = Map.prototype;
const MAP_SIZE = Object.getOwnPropertyDescriptor(MAP, 'size')!.get!;

declare namespace map {
  /** Map whose entries a factory makes - `map(make)`. Keyed by the factory's first parameter. */
  export interface Create<A extends [unknown, ...unknown[]], V> extends Managed<A[0], V> {
    /**
     * Store what the factory returns for `args` at `args[0]`; returns the map.
     *
     * An occupied key is replaced - its owned value destroyed - unless the factory returns the
     * value already there.
     */
    set(...args: A): this;
  }

  /** Map of values given directly - `map()` and `map(entries)`. */
  export interface Insert<K, V> extends Managed<K, V> {
    /**
     * Store `value` at `key`; returns the map.
     *
     * Replacing destroys the previous owned value. The value already there does nothing.
     */
    set(key: K, value: V): this;
  }

  export { Managed };
}

/**
 * Reactive `Map` - seeded from `entries` when given.
 *
 * `entries` is copied; falsy is empty. A fresh Model value is owned, an active one a guest. The field
 * is read-only - assigning it throws. Cleared when the owner is destroyed.
 *
 * @example
 * products = map<string, Product>();
 *
 * add(product: Product) {
 *   this.products.set(product.id, product);
 * }
 */
function map<K, V>(
  entries?: Iterable<readonly [K, V]> | false | null
): map.Insert<K, V>;

/**
 * Reactive `Map` whose `set(key, ...rest)` stores what `make` returns for those arguments.
 *
 * Keyed by `make`'s first parameter. No direct insertion - every entry passes through `make`. A fresh
 * Model result is owned, an active one a guest. The field is read-only - assigning it throws.
 *
 * @example
 * items = map((id: string) => new Line(id));
 *
 * open(id: string) {
 *   return this.items.set(id).get(id)!;
 * }
 */
function map<A extends [unknown, ...unknown[]], V>(
  make: (...args: A) => V
): map.Create<A, V>;

function map(
  arg?: Iterable<readonly [unknown, unknown]> | Function | false | null
): unknown {
  return def((_key, subject) => {
    const value = new Managed(typeof arg == 'function' && arg);

    parent(value, subject);
    listener(subject, () => value.clear(), null);

    if (arg && typeof arg == 'object')
      for (const [key, entry] of arg) value.set(key, entry);

    return { set: false, value };
  });
}

/**
 * Reactive native `Map` subclass - the runtime class behind both `map` modes.
 *
 * Reads track the keys they visit, plus shape for size and iteration; writes notify the changed key,
 * plus shape when a key is added or removed. Keys compare as in `Map` - any type, `undefined`
 * included. A fresh Model value is owned: parented to the map's owner, activated in its context,
 * destroyed when deleted, replaced, cleared or the owner dies. An already-active one is a guest -
 * held, never destroyed. A Model value that dies evicts every key holding it. A Model read through
 * a tracked map is tracked too. Constructible standalone - `new map.Managed()` - owning values
 * without a context.
 */
class Managed<K, V> extends Map<K, V> {
  constructor(arg?: Iterable<readonly [K, V]> | Function | false | null) {
    super();

    MAKE.set(this, typeof arg == 'function' ? arg : KEYED);
    OWNED.set(this, new Map());

    event(this);

    if (arg && typeof arg != 'function')
      for (const [key, value] of arg) store(this, key, value);
  }

  /** The instance to render - this, or the source behind a derived view. */
  get is(): this {
    return source(this);
  }

  /** Values to render, as a host sees them. */
  render(): V[] {
    return [...this.values()];
  }

  /** Number of entries - tracks shape. */
  get size(): number {
    return touch(this, SHAPE, MAP_SIZE.call(source(this)));
  }

  /**
   * Shallow snapshot of the entries - untracked.
   *
   * A value with a `get()` method exports through it, as Model snapshots do.
   */
  get(): ReadonlyMap<K, Model.Export<V>>;

  /** Value at `key` - tracks that key only. */
  get(key: K): V | undefined;
  get(key?: K): unknown {
    const target = source(this);

    return arguments.length
      ? touch(this, key, super.get.call(target, key as K)) 
      : new Map(
        Array.from(MAP.entries.call(target), ([key, value]) => [
          key,
          value && typeof value === 'object' && typeof value.get === 'function'
            ? value.get()
            : value
        ])
      );
  }

  /** Whether `key` is present - tracks that key only. */
  has(key: K): boolean {
    return touch(this, key, MAP.has.call(source(this), key));
  }

  /**
   * Store at `key` - the value given, or what a factory returns; returns the map.
   *
   * Replacing destroys the previous owned value. The value already there does nothing. Storing a
   * destroyed Model throws.
   */
  set(key: K, ...rest: unknown[]): this {
    const target = source(this);
    const value = MAKE.get(target)!(key, ...rest) as V;

    store(target, key, value);
    return this;
  }

  /** Remove `key`, destroying an owned value; false if absent. Notifies that key and shape. */
  delete(key: K) {
    const target = source(this);

    if (!MAP.has.call(target, key)) return false;

    release(target, key);
    MAP.delete.call(target, key);

    event(target, key as never);
    event(target, SHAPE);

    return true;
  }

  /** Remove every entry, destroying owned values - also run when the owner is destroyed. */
  clear() {
    const target = source(this);
    const keys = Array.from(MAP.keys.call(target));

    if (!keys.length) return;

    for (const key of keys) release(target, key);

    MAP.clear.call(target);

    for (const key of keys) event(target, key as never);
    event(target, SHAPE);
  }

  /** Entries in insertion order - tracks shape and each value visited. */
  entries(): MapIterator<[K, V]>;

  /**
   * Reusable iterable of `fn` over each entry - every pass reads the live map.
   *
   * Tracks as `entries()` does. Throw `false` in `fn` to skip an entry; other errors propagate.
   */
  entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
  entries(fn?: (entry: [K, V]) => unknown): any {
    const self = this;
    function* iterate() {
      const target = source(self);

      touch(self, SHAPE);

      for (const [key, value] of MAP.entries.call(target))
        yield [key, touch(self, key, value)] as [K, V];
    }

    return fn ? transform(iterate, fn) : iterate();
  }

  /** Keys in insertion order - tracks shape only, not values. */
  keys(): MapIterator<K>;

  /**
   * Reusable iterable of `fn` over each key - every pass reads the live map.
   *
   * Tracks as `keys()` does. Throw `false` in `fn` to skip a key; other errors propagate.
   */
  keys<R>(fn: (key: K) => R): Iterable<R>;
  keys(fn?: (key: K) => unknown): any {
    const self = this;
    function* iterate() {
      touch(self, SHAPE);
      yield* MAP.keys.call(source(self)) as IterableIterator<K>;
    }

    return fn ? transform(iterate, fn) : iterate();
  }

  /** Values in insertion order - tracks shape and each value visited. */
  values(): MapIterator<V>;

  /**
   * Reusable iterable of `fn` over each value - every pass reads the live map.
   *
   * Tracks as `values()` does. Throw `false` in `fn` to skip a value; other errors propagate.
   *
   * @example
   * class Cart extends Model {
   *   items = map((id: string) => new Line(id));
   *
   *   get subtotals() {
   *     return [...this.items.values((line) => line.price * line.qty)];
   *   }
   * }
   */
  values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  values(fn?: (value: V, key: K) => unknown): any {
    if (fn)
      return this.entries(([key, value]) => fn(value, key));

    const self = this;
    return (function* () {
      for (const [, value] of self.entries())
        yield value;
    })();
  }

  /** Call `callbackfn` per entry, as `Map` does - tracks as `entries()` does. */
  forEach(
    callbackfn: (value: V, key: K, map: this) => void,
    thisArg?: unknown
  ) {
    for (const [key, value] of this.entries())
      callbackfn.call(thisArg, value, key, this);
  }

  /** Entries in insertion order - as `entries()`. */
  [Symbol.iterator]() {
    return this.entries();
  }
}

Object.assign(map, { Managed });

function transform<T, R>(
  iterate: () => Generator<T>,
  fn: (item: T) => R
): Iterable<R> {
  return {
    *[Symbol.iterator]() {
      for (const item of iterate())
        try {
          yield fn(item);
        } catch (err) {
          if (err !== false) throw err;
        }
    }
  };
}

function store<K, V>(target: Managed<K, V>, key: K, value: V) {
  const exists = MAP.has.call(target, key);

  if (exists && MAP.get.call(target, key) === value) return;

  const model = value instanceof Model ? value : undefined;
  const evict = model && listener(model, () => void target.delete(key), null);

  if (exists) release(target, key);

  MAP.set.call(target, key, value);

  if (model) {
    const owner = parent(target);
    const fresh = parent(model, owner ?? null);

    let detach: (() => void) | undefined;

    if (fresh && owner)
      detach = join(owner, model);

    OWNED.get(target)!.set(key, () => {
      evict!();
      if (detach) detach();
      if (fresh) model.set(null);
    });

    if (fresh) event(model);
  }

  event(target, key as never);

  if (!exists) event(target, SHAPE);
}

function release(target: object, key: unknown) {
  const owned = OWNED.get(target)!;
  const free = owned.get(key);

  if (free) {
    owned.delete(key);
    free();
  }
}

function source<T extends object>(from: T): T {
  return OWNED.has(from) ? from : Object.getPrototypeOf(from);
}

element(Managed);

export { map };
