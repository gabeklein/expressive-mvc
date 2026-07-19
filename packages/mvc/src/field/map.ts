import { Context } from '../context';
import { event, listener, touch } from '../observable';
import { State, parent } from '../state';

const SHAPE = Symbol('shape');
const SIZE = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!;
const META = new WeakMap<object, Meta>();

type Meta = {
  make?: Function;
  owner?: State;
  owned: Map<unknown, (() => void) | undefined>;
};

State.on((self) => {
  for (const key in self) {
    const target = Object.getOwnPropertyDescriptor(self, key)?.value;
    const meta = META.get(target);

    if (!meta || meta.owner) continue;

    meta.owner = self;

    for (const [key, value] of Map.prototype.entries.call(target))
      if (value instanceof State && parent(value) === undefined) {
        meta.owned.set(key, attach(value, self));
        event(value);
      }

    listener(
      self,
      () => {
        for (const [key] of meta.owned)
          release(target, key, Map.prototype.get.call(target, key));
      },
      null
    );
  }
});

class ReactiveMap<K, V> extends Map<K, V> implements State.Map<K, V> {
  constructor(entries?: Iterable<readonly [K, V]> | null, make?: Function) {
    super();

    if (entries) for (const [key, value] of entries) super.set(key, value);

    META.set(this, { make, owned: new Map() });

    event(this);
  }

  get size(): number {
    return touch(this, SHAPE, SIZE.call(source(this)));
  }

  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  get(key?: K): V | undefined | ReadonlyMap<K, State.Export<V>> {
    const target = source(this);

    if (!arguments.length)
      return new Map(
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

  add(input?: unknown): V {
    const target = source(this);
    const meta = META.get(target)!;

    if (!meta.make)
      throw new Error('add() requires a map created with a factory.');

    const keyed = typeof input == 'string';

    if (keyed && super.has.call(target, input as K))
      throw new Error('Key is already occupied; use set() to replace.');

    const value = spawn(meta, input) as V;
    const key = keyed
      ? input
      : (value instanceof State && (value as any).key) || String(value);

    if (!keyed && super.has.call(target, key as K)) {
      if (value instanceof State && parent(value) !== undefined)
        value.set(null);

      throw new Error('Key is already occupied; use set() to replace.');
    }

    store(target, key as K, value, true);
    return value;
  }

  set(key: K): this;
  set(key: K, value: V): this;
  set(key: K, value?: V) {
    const target = source(this);

    if (arguments.length === 1) {
      const meta = META.get(target)!;

      if (!meta.make)
        throw new Error('set(key) alone requires a factory.');

      store(target, key, spawn(meta, key) as V, true);
      return this;
    }

    store(target, key, value as V);
    return this;
  }

  delete(key: K) {
    const target = source(this);

    if (!super.has.call(target, key)) return false;

    release(target, key, super.get.call(target, key) as V);
    super.delete.call(target, key);

    event(target, key as never);
    event(target, SHAPE);

    return true;
  }

  clear() {
    const target = source(this);

    if (!SIZE.call(target)) return;

    const entries = Array.from(super.entries.call(target));

    for (const [key, value] of entries) release(target, key, value);

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
    for (const [key, value] of this)
      callbackfn.call(thisArg, value, key, this);
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

function map<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): State.Map<K, V>;

function map<T extends State>(
  Type: new (...args: any[]) => T
): State.Map.Factory<T, State.Map.Key<T> | State.Assign<T>>;

function map<V, I = string>(
  make: (input: I) => V,
  entries?: Iterable<readonly [string, V]> | null
): State.Map.Factory<V, I>;

function map<K, V>(
  arg?: Iterable<readonly [K, V]> | Function | null,
  entries?: Iterable<readonly [K, V]> | null
): State.Map<K, V> {
  return typeof arg == 'function'
    ? new ReactiveMap(entries, arg)
    : new ReactiveMap(arg);
}

function spawn({ make }: Meta, input: unknown) {
  return State.is(make)
    ? new (make as State.Type)(typeof input === 'string' ? { key: input } : input as {})
    : make!(input);
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
  own?: boolean
) {
  const meta = META.get(target)!;
  const exists = Map.prototype.has.call(target, key);

  if (exists) {
    const previous = Map.prototype.get.call(target, key) as V;

    if (previous === value) return;

    release(target, key, previous);
  }

  Map.prototype.set.call(target, key, value);

  if (value instanceof State && parent(value) === undefined) {
    meta.owned.set(key, meta.owner && attach(value, meta.owner) || undefined);
    event(value);
  }
  else if (own) meta.owned.set(key, undefined);

  event(target, key as never);
  if (!exists) event(target, SHAPE);
}

function release<K, V>(target: ReactiveMap<K, V>, key: K, value: V) {
  const { owned } = META.get(target)!;

  if (!owned.has(key)) return;

  const detach = owned.get(key);

  owned.delete(key);

  if (detach) detach();
  if (value instanceof State) value.set(null);
}

function source<K, V>(from: ReactiveMap<K, V>): ReactiveMap<K, V> {
  return META.has(from) ? from : Object.getPrototypeOf(from);
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

export { map };
