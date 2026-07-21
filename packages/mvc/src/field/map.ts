import { Context } from '../context';
import { event, listener, touch } from '../observable';
import { State, parent } from '../state';
import { def } from './def';

const SHAPE = Symbol('shape');
const KEYED = (_key: unknown, value: unknown) => value;

const MAKE = new WeakMap<object, Function>();
const OWNER = new WeakMap<object, State>();
const OWNED = new WeakMap<object, Map<unknown, () => void>>();

const MAP = Map.prototype;
const MAP_SIZE = Object.getOwnPropertyDescriptor(MAP, 'size')!.get!;

interface Native {
  has(key: any): boolean;
  delete(key: any): boolean;
  clear(): void;
  entries(): IterableIterator<[unknown, unknown]>;
  keys(): IterableIterator<unknown>;
}

interface MapLike<K, V> {
  readonly size: number;
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

declare namespace map {
  interface Create<A extends [unknown, ...unknown[]], V>
    extends MapLike<A[0], V> {
    set(...args: A): this;
  }

  type Insert<K, V> = map.Create<[key: K, value: V], V>;

  let Create: typeof ReactiveMap;
}

function map<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): map.Insert<K, V>;

function map<A extends [unknown, ...unknown[]], V>(
  make: (...args: A) => V
): map.Create<A, V>;

function map(
  arg?: Iterable<readonly [unknown, unknown]> | Function | null
): unknown {
  return def((_key, subject) => ({
    set: false,
    value: new ReactiveMap(subject, arg)
  }));
}

class ReactiveMap<K, V> extends Map<K, V> implements map.Insert<K, V> {
  constructor(
    owner: State,
    arg?: Iterable<readonly [K, V]> | Function | null
  ) {
    super();

    init(this, owner, typeof arg == 'function' ? arg : KEYED);

    if (arg && typeof arg != 'function')
      for (const [key, value] of arg) store(this, key, value);
  }

  get size(): number {
    return touch(this, SHAPE, MAP_SIZE.call(source(this)));
  }

  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  get(key?: K): unknown {
    const target = source(this);

    return arguments.length
      ? touch(this, key, super.get.call(target, key as K)) 
      : new Map(
        Array.from(MAP.entries.call(target), ([key, value]) => [
          key, exportValue(value)
        ])
      );
  }

  has(key: K): boolean {
    return probe(this, MAP, key);
  }

  set(key: K, ...rest: unknown[]): this {
    const target = source(this);
    const value = MAKE.get(target)!(key, ...rest) as V;

    store(target, key, value, !rest.includes(value));
    return this;
  }

  delete(key: K) {
    return remove(this, MAP, key);
  }

  clear() {
    flush(this, MAP);
  }

  entries(): MapIterator<[K, V]>;
  entries<R>(fn: (entry: [K, V]) => R): Iterable<R>;
  entries(fn?: (entry: [K, V]) => unknown): any {
    return entriesOf(this, MAP, fn);
  }

  keys(): MapIterator<K>;
  keys<R>(fn: (key: K) => R): Iterable<R>;
  keys(fn?: (key: K) => unknown): any {
    return keysOf(this, MAP, fn);
  }

  values(): MapIterator<V>;
  values<R>(fn: (value: V, key: K) => R): Iterable<R>;
  values(fn?: (value: V, key: K) => unknown): any {
    return valuesOf(this, MAP, fn);
  }

  forEach(
    callbackfn: (value: V, key: K, map: this) => void,
    thisArg?: unknown
  ) {
    for (const [key, value] of this.entries())
      callbackfn.call(thisArg, value, key, this);
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

map.Create = ReactiveMap;

function init(
  self: ReactiveMap<unknown, unknown>,
  owner: State,
  make: Function
) {
  MAKE.set(self, make);
  OWNER.set(self, owner);
  OWNED.set(self, new Map());

  listener(owner, () => self.clear(), null);

  event(self);
}

function probe(self: object, native: Native, key: unknown) {
  return touch(self, key, native.has.call(source(self), key));
}

function remove(self: object, native: Native, key: unknown) {
  const target = source(self);

  if (!native.has.call(target, key)) return false;

  release(target, key);
  native.delete.call(target, key);

  event(target, key as never);
  event(target, SHAPE);

  return true;
}

function flush(self: object, native: Native) {
  const target = source(self);
  const keys = Array.from(native.keys.call(target));

  if (!keys.length) return;

  for (const key of keys) release(target, key);

  native.clear.call(target);

  for (const key of keys) event(target, key as never);
  event(target, SHAPE);
}

function entriesOf<K, V>(
  self: object,
  native: Native,
  fn?: (entry: [K, V]) => unknown
) {
  function* iterate() {
    const target = source(self);

    touch(self, SHAPE);

    for (const [key, value] of native.entries.call(target))
      yield [key, touch(self, key, value)] as [K, V];
  }

  return fn ? transform(iterate, fn) : iterate();
}

function keysOf<K>(
  self: object,
  native: Native,
  fn?: (key: K) => unknown
) {
  function* iterate() {
    touch(self, SHAPE);
    yield* native.keys.call(source(self)) as IterableIterator<K>;
  }

  return fn ? transform(iterate, fn) : iterate();
}

function valuesOf<K, V>(
  self: object,
  native: Native,
  fn?: (value: V, key: K) => unknown
) {
  if (fn)
    return entriesOf<K, V>(self, native, ([key, value]) => fn(value, key));

  return (function* () {
    for (const [, value] of entriesOf<K, V>(self, native) as Generator<[K, V]>)
      yield value;
  })();
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
  const exists = MAP.has.call(target, key);

  if (exists) {
    if (MAP.get.call(target, key) === value) return;

    release(target, key);
  }

  MAP.set.call(target, key, value);
  adopt(target, key, value, spawned);

  event(target, key as never);
  if (!exists) event(target, SHAPE);
}

function adopt(
  target: { delete(key: never): boolean },
  key: unknown,
  value: unknown,
  spawned?: boolean
) {
  if (value instanceof State) {
    const fresh = parent(value) === undefined;
    const detach = fresh ? attach(value, OWNER.get(target)!) : undefined;
    const evict = listener(value, () => void target.delete(key as never), null);

    OWNED.get(target)!.set(key, () => {
      evict();
      if (detach) detach();
      if (fresh || spawned) value.set(null);
    });

    if (fresh) event(value);
  }
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

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

export { map };
