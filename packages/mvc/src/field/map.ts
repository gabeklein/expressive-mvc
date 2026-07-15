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
  entry: boolean;
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
        entry: !make.length,
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

  add(): V;
  add(input: unknown): V;
  add(input?: unknown): V {
    const target = source(this);
    const meta = META.get(target);

    if (!meta)
      throw new Error('add() requires a map created with a factory.');

    if (meta.type) {
      const value = (
        input === undefined
          ? (meta.make as State.Type).new()
          : (meta.make as State.Type).new(input as never)
      ) as V;

      store(target, globalThis.String(value) as K, value, meta);
      return value;
    }

    if (meta.entry) {
      const entry = meta.make() as [K, V];

      if (!globalThis.Array.isArray(entry) || entry.length !== 2)
        throw new Error('Factory must return a [key, value] entry.');

      store(target, entry[0], entry[1], meta);
      return entry[1];
    }

    if (HAS.call(target, input))
      return GET.call(target, input) as V;

    const value = meta.make(input) as V;

    store(target, input as K, value, meta);
    return value;
  }

  set(key: K, value: V) {
    store(source(this), key, value);
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
  Type: State.Type<T>
): State.Map<string, T, State.Assign<T>>;
function map<K, V>(make: () => readonly [K, V]): State.Map<K, V, never>;
function map<K, V>(
  make: (key: K) => V,
  entries?: Iterable<readonly [K, V]> | null
): State.Map<K, V>;
function map<K, V>(
  arg?: Iterable<readonly [K, V]> | Function | null,
  entries?: Iterable<readonly [K, V]> | null
): State.Map<K, V, any> {
  return typeof arg == 'function'
    ? new ReactiveMap(entries, arg)
    : new ReactiveMap(arg);
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
