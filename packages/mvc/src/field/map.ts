import { event, touch } from '../observable';
import { State } from '../state';

const SHAPE = Symbol('shape');
const SIZE = Object.getOwnPropertyDescriptor(globalThis.Map.prototype, 'size')!
  .get!;
const GET = globalThis.Map.prototype.get;
const HAS = globalThis.Map.prototype.has;
const SET = globalThis.Map.prototype.set;
const DELETE = globalThis.Map.prototype.delete;
const CLEAR = globalThis.Map.prototype.clear;
const ENTRIES = globalThis.Map.prototype.entries;
const KEYS = globalThis.Map.prototype.keys;

type Meta = {
  make: Function;
  type: boolean;
  spawned: Set<unknown>;
};

const META = new WeakMap<object, Meta>();

class ReactiveMap<K, V>
  extends globalThis.Map<K, V>
  implements State.Map<K, V> {
  constructor(entries?: Iterable<readonly [K, V]> | null, make?: Function) {
    super();

    if (entries) for (const [key, value] of entries) super.set(key, value);

    if (make)
      META.set(this, {
        make,
        type: State.is(make),
        spawned: new Set()
      });

    event(this);
  }

  get size() {
    return touch(this, SHAPE, SIZE.call(source(this)));
  }

  get(): ReadonlyMap<K, State.Export<V>>;
  get(key: K): V | undefined;
  get(key?: K): V | undefined | ReadonlyMap<K, State.Export<V>> {
    if (!arguments.length)
      return new globalThis.Map(
        globalThis.Array.from(ENTRIES.call(source(this)), ([key, value]) => [
          key,
          exportValue(value)
        ])
      );

    return touch(this, key, GET.call(source(this), key as K));
  }

  has(key: K): boolean {
    return touch(this, key, HAS.call(source(this), key));
  }

  add(input?: unknown): V {
    const target = source(this);
    const meta = META.get(target);

    if (!meta)
      throw new Error('add() requires a map created with a factory.');

    const keyed = typeof input == 'string';

    if (keyed && HAS.call(target, input))
      throw new Error('Key is already occupied; use set() to replace.');

    const value = spawn(meta, input) as V;
    const key = keyed ? input : globalThis.String(value);

    if (!keyed && HAS.call(target, key)) {
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
      const meta = META.get(target);

      if (!meta)
        throw new Error('set(key) alone requires a factory.');

      store(target, key, spawn(meta, key) as V, meta);
      return this;
    }

    store(target, key, value as V);
    return this;
  }

  delete(key: K) {
    const target = source(this);

    if (!HAS.call(target, key)) return false;

    release(target, key, GET.call(target, key));

    const deleted = DELETE.call(target, key);

    if (deleted) {
      event(target, key as never);
      event(target, SHAPE);
    }

    return deleted;
  }

  clear() {
    const target = source(this);

    if (!SIZE.call(target)) return;

    const entries = globalThis.Array.from(ENTRIES.call(target));

    for (const [key, value] of entries) release(target, key, value);

    CLEAR.call(target);

    for (const [key] of entries) event(target, key as never);
    event(target, SHAPE);
  }

  *entries(): MapIterator<[K, V]> {
    const target = source(this);

    touch(this, SHAPE);

    for (const [key, value] of ENTRIES.call(target))
      yield [key, touch(this, key, value)];
  }

  *keys(): MapIterator<K> {
    touch(this, SHAPE);
    yield* KEYS.call(source(this));
  }

  *values(): MapIterator<V> {
    const target = source(this);

    touch(this, SHAPE);

    for (const [key, value] of ENTRIES.call(target))
      yield touch(this, key, value);
  }

  forEach(
    callbackfn: (value: V, key: K, map: globalThis.Map<K, V>) => void,
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
): State.Map.Factory<T, string | State.Assign<T>>;
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

function spawn(meta: Meta, key: unknown) {
  if (!meta.type) return meta.make(key);

  return key === undefined
    ? (meta.make as State.Type).new()
    : (meta.make as State.Type).new(key as never);
}

function store<K, V>(
  target: ReactiveMap<K, V>,
  key: K,
  value: V,
  meta?: Meta
) {
  const exists = HAS.call(target, key);

  if (exists) {
    const previous = GET.call(target, key);

    if (previous === value) return;

    release(target, key, previous);
  }

  SET.call(target, key, value);

  if (meta) meta.spawned.add(key);

  event(target, key as never);
  if (!exists) event(target, SHAPE);
}

function release<K, V>(target: ReactiveMap<K, V>, key: K, value: V) {
  const meta = META.get(target);

  if (meta && meta.spawned.delete(key) && value instanceof State)
    value.set(null);
}

function source<K, V>(target: ReactiveMap<K, V>) {
  try {
    globalThis.Map.prototype.has.call(target, SHAPE);
    return target;
  } catch {
    return Object.getPrototypeOf(target) as ReactiveMap<K, V>;
  }
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

export { map };
