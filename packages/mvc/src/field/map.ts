import { Context } from '../context';
import { event, listener, touch } from '../observable';
import { State, parent } from '../state';
import { def } from './def';

const SHAPE = Symbol('shape');
const SIZE = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!;

const MAKE = new WeakMap<object, Function>();
const POOL = new WeakSet<object>();
const OWNER = new WeakMap<object, State>();
const OWNED = new WeakMap<object, Map<unknown, () => void>>();

declare namespace map {
  interface Keyed<K, V> extends globalThis.Map<K, V> {
    get(): ReadonlyMap<K, State.Export<V>>;
    get(key: K): V | undefined;
    entries(): MapIterator<[K, V]>;
    entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
    keys(): MapIterator<K>;
    keys<R>(fn: (key: K) => R): Iterable<R>;
    values(): MapIterator<V>;
    values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  }

  interface Create<K, A extends unknown[], V> {
    readonly size: number;
    set(key: K, ...args: A): this;
    get(): ReadonlyMap<K, State.Export<V>>;
    get(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    entries(): MapIterator<[K, V]>;
    entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
    keys(): MapIterator<K>;
    keys<R>(fn: (key: K) => R): Iterable<R>;
    values(): MapIterator<V>;
    values<R>(fn: (value: V, key: K) => R): Iterable<R>;
    forEach(fn: (value: V, key: K, map: this) => void, thisArg?: unknown): void;
    [Symbol.iterator](): MapIterator<[K, V]>;
  }

  interface Pool<V, A extends unknown[] = []> {
    readonly size: number;
    add(...args: A): V;
    get(): ReadonlySet<State.Export<V>>;
    has(value: V): boolean;
    delete(value: V): boolean;
    clear(): void;
    values(): MapIterator<V>;
    values<R>(fn: (value: V) => R): Iterable<R>;
    [Symbol.iterator](): MapIterator<V>;
  }
}

function map<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): map.Keyed<K, V>;

function map<T extends State>(
  Type: new (...args: State.Args<T>) => T
): map.Pool<T, State.Args<T>>;

function map<V>(make: () => V): map.Pool<V>;

function map<K, A extends unknown[], V>(
  make: (key: K, ...args: A) => V
): map.Create<K, A, V>;

function map(
  arg?: Iterable<readonly [unknown, unknown]> | Function | null
): unknown {
  return def((_key, subject) => ({
    set: false,
    value: new ReactiveMap(subject, arg)
  }));
}

class ReactiveMap<K, V> extends Map<K, V> implements map.Keyed<K, V> {
  constructor(
    owner: State,
    arg?: Iterable<readonly [K, V]> | Function | null
  ) {
    super();

    OWNER.set(this, owner);
    OWNED.set(this, new Map());

    listener(owner, () => this.clear(), null);

    event(this);

    if (typeof arg == 'function') {
      MAKE.set(this, arg);

      if (State.is(arg) || !arg.length) POOL.add(this);
    }
    else if (arg)
      for (const [key, value] of arg) store(this, key, value);
  }

  get size(): number {
    return touch(this, SHAPE, SIZE.call(source(this)));
  }

  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  get(key?: K): unknown {
    const target = source(this);

    if (!arguments.length)
      return POOL.has(target)
        ? new Set(Array.from(super.values.call(target), exportValue))
        : new Map(
            Array.from(super.entries.call(target), ([key, value]) => [
              key,
              exportValue(value)
            ])
          );

    return touch(this, key, super.get.call(target, key as K));
  }

  has(key: K): boolean {
    return touch(this, key, super.has.call(source(this), key));
  }

  add(...args: unknown[]): V {
    const target = source(this);
    const make = MAKE.get(target);

    if (!make || !POOL.has(target))
      throw new Error('add() requires a pool.');

    const value = (
      State.is(make)
        ? new (make as State.Type)(...(args as State.Args))
        : make()
    ) as V;

    store(target, value as unknown as K, value, true);
    return value;
  }

  set(key: K, ...rest: unknown[]): this {
    const target = source(this);

    if (POOL.has(target))
      throw new Error('set() is not valid on a pool.');

    const make = MAKE.get(target);
    const value = (make ? make(key, ...rest) : rest[0]) as V;

    store(target, key, value, !!make && !rest.includes(value));
    return this;
  }

  delete(key: K) {
    const target = source(this);

    if (!super.has.call(target, key)) return false;

    release(target, key);
    super.delete.call(target, key);

    event(target, key as never);
    event(target, SHAPE);

    return true;
  }

  clear() {
    const target = source(this);

    if (!SIZE.call(target)) return;

    const entries = Array.from(super.entries.call(target));

    for (const [key] of entries) release(target, key);

    super.clear.call(target);

    for (const [key] of entries) event(target, key as never);
    event(target, SHAPE);
  }

  entries(): MapIterator<[K, V]>;
  entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
  entries(fn?: (entry: [K, V]) => unknown) {
    const self = this;

    function* iterate() {
      const target = source(self);

      touch(self, SHAPE);

      for (const [key, value] of Map.prototype.entries.call(target))
        yield [key, touch(self, key, value)] as [K, V];
    }

    return fn ? transform(iterate, fn) : iterate();
  }

  keys(): MapIterator<K>;
  keys<R>(fn: (key: K) => R): Iterable<R>;
  keys(fn?: (key: K) => unknown) {
    const self = this;

    function* iterate() {
      touch(self, SHAPE);
      yield* Map.prototype.keys.call(source(self)) as MapIterator<K>;
    }

    return fn ? transform(iterate, fn) : iterate();
  }

  values(): MapIterator<V>;
  values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  values(fn?: (value: V, key: K) => unknown): any {
    if (fn) return this.entries(([key, value]) => fn(value, key));

    return (function* (self) {
      for (const [, value] of self.entries()) yield value;
    })(this);
  }

  forEach(
    callbackfn: (value: V, key: K, map: Map<K, V>) => void,
    thisArg?: unknown
  ) {
    for (const [key, value] of this.entries())
      callbackfn.call(thisArg, value, key, this);
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return (
      POOL.has(source(this)) ? this.values() : this.entries()
    ) as MapIterator<[K, V]>;
  }
}

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

function attach(value: State, owner: State) {
  const detach = Context.get(owner).add(value);

  parent(value, owner);

  return detach;
}

function store<K, V>(
  target: ReactiveMap<K, V>,
  key: K,
  value: V,
  spawned?: boolean
) {
  const exists = Map.prototype.has.call(target, key);

  if (exists) {
    if (Map.prototype.get.call(target, key) === value) return;

    release(target, key);
  }

  Map.prototype.set.call(target, key, value);

  if (value instanceof State) {
    const fresh = parent(value) === undefined;
    const detach = fresh ? attach(value, OWNER.get(target)!) : undefined;
    const evict = listener(value, () => void target.delete(key), null);

    OWNED.get(target)!.set(key, () => {
      evict();
      if (detach) detach();
      if (fresh || spawned) value.set(null);
    });

    if (fresh) event(value);
  }

  event(target, key as never);
  if (!exists) event(target, SHAPE);
}

function release<K, V>(target: ReactiveMap<K, V>, key: K) {
  const owned = OWNED.get(target)!;
  const free = owned.get(key);

  if (free) {
    owned.delete(key);
    free();
  }
}

function source<K, V>(from: ReactiveMap<K, V>): ReactiveMap<K, V> {
  return OWNED.has(from) ? from : Object.getPrototypeOf(from);
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

export { map };
