import { event, touch } from '../observable';
import { State, parent } from '../state';

const SHAPE = Symbol('shape');
const SIZE = Object.getOwnPropertyDescriptor(Map.prototype, 'size')!.get!;
const META = new WeakMap<object, Meta>();

type Meta = {
  make?: Function;
  spawned: Set<unknown>;
};

class ReactiveMap<K, V>
  extends Map<K, V>
  implements State.Map<K, V> {
  constructor(entries?: Iterable<readonly [K, V]> | null, make?: Function) {
    super();

    if (entries) for (const [key, value] of entries) super.set(key, value);

    META.set(this, { make, spawned: new Set() });

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
      if (value instanceof State) value.set(null);
      throw new Error('Key is already occupied; use set() to replace.');
    }

    store(target, key as K, value, meta);
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

      store(target, key, spawn(meta, key) as V, meta);
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

  *entries(): MapIterator<[K, V]> {
    const target = source(this);

    touch(this, SHAPE);

    for (const [key, value] of super.entries.call(target))
      yield [key, touch(this, key, value)];
  }

  *keys(): MapIterator<K> {
    touch(this, SHAPE);
    yield* super.keys.call(source(this));
  }

  *values(): MapIterator<V> {
    for (const [, value] of this.entries()) yield value;
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
  if (!State.is(make)) return make!(input);

  const Type = make as State.Type;

  if (input === undefined) return new Type();
  if (typeof input == 'string') return new Type({ key: input } as never);

  return new Type(input as never);
}

function store<K, V>(
  target: ReactiveMap<K, V>,
  key: K,
  value: V,
  meta?: Meta
) {
  const exists = Map.prototype.has.call(target, key);

  if (exists) {
    const previous = Map.prototype.get.call(target, key) as V;

    if (previous === value) return;

    release(target, key, previous);
  }

  if (value instanceof State && parent(value) === undefined) event(value);

  Map.prototype.set.call(target, key, value);

  if (meta) meta.spawned.add(key);

  event(target, key as never);
  if (!exists) event(target, SHAPE);
}

function release<K, V>(target: ReactiveMap<K, V>, key: K, value: V) {
  if (META.get(target)!.spawned.delete(key) && value instanceof State)
    value.set(null);
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
