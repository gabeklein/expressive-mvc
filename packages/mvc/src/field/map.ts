import { event, touch } from '../observable';
import type { State } from '../state';

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

class ReactiveMap<K, V>
  extends globalThis.Map<K, V>
  implements State.Map<K, V> {
  constructor(entries?: Iterable<readonly [K, V]> | null) {
    super();

    if (entries) for (const [key, value] of entries) super.set(key, value);

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

  set(key: K, value: V) {
    const target = source(this);
    const exists = HAS.call(target, key);
    const previous = GET.call(target, key);

    if (exists && previous === value) return this;

    SET.call(target, key, value);
    event(target, key as never);
    if (!exists) event(target, SHAPE);

    return this;
  }

  delete(key: K) {
    const target = source(this);

    if (!HAS.call(target, key)) return false;

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

    const keys = globalThis.Array.from(KEYS.call(target));

    CLEAR.call(target);

    for (const key of keys) event(target, key as never);
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
): State.Map<K, V> {
  return new ReactiveMap(entries);
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
