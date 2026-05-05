import { event, touch } from './observable';

const LENGTH = Symbol('length');
const ITEMS = Symbol('items');

declare namespace List {
  type Predicate<T> = (value: T, index: number, list: List<T>) => boolean;
  type Mapper<T, U> = (value: T, index: number, list: List<T>) => U;
}

class List<T> {
  declare readonly [ITEMS]: T[];

  constructor(initial: Iterable<T> = []) {
    Object.defineProperty(this, ITEMS, {
      value: Array.from(initial)
    });
    event(this);
  }

  get size(): number {
    return touch(this, LENGTH, this[ITEMS].length);
  }

  get(): T[];
  get(index: number): T | undefined;
  get(start: number, end: number): T[];
  get(predicate: List.Predicate<T>): T | undefined;
  get(arg?: number | List.Predicate<T>, second?: number) {
    const items = this[ITEMS];

    if (arg === undefined) return items.map(exportValue);

    if (typeof arg === 'function') {
      touch(this, LENGTH);
      return items.find((v, i) => arg(touch(this, i, v), i, this));
    }

    if (typeof second !== 'number') {
      const at = arg < 0 ? items.length + arg : arg;

      return at < 0 || at >= items.length
        ? touch(this, LENGTH)
        : touch(this, at, items[at]);
    }

    touch(this, LENGTH);

    const start = arg < 0 ? Math.max(items.length + arg, 0) : arg;

    return items
      .slice(start, Math.min(second, items.length))
      .map((v, i) => touch(this, start + i, v));
  }

  set(index: number, value: T) {
    const items = this[ITEMS];
    const at = index < 0 ? items.length + index : index;

    if (at < 0 || at >= items.length || items[at] === value) return;

    items[at] = value;
    event(this, at);
  }

  put(index: number, ...items: T[]) {
    if (!items.length) return;

    const arr = this[ITEMS];
    const at =
      index < 0 ? Math.max(arr.length + index, 0) : Math.min(index, arr.length);

    arr.splice(at, 0, ...items);

    for (let i = at; i < arr.length; i++) event(this, i);
    event(this, LENGTH);
  }

  push(...values: T[]): number {
    this.put(this[ITEMS].length, ...values);
    return this[ITEMS].length;
  }

  pop(): T | undefined;
  pop(index: number): T | undefined;
  pop(index: number, count: number): T[];
  pop(index = -1, count?: number): T | T[] | undefined {
    const items = this[ITEMS];
    const before = items.length;
    const start =
      index < 0 ? Math.max(before + index, 0) : Math.min(index, before);
    const removed = items.splice(start, count ?? 1);

    if (removed.length) {
      const end = Math.max(before, items.length);
      for (let i = start; i < end; i++) event(this, i);
      event(this, LENGTH);
    }

    return count === undefined ? removed[0] : removed;
  }

  clear() {
    this.pop(0, this[ITEMS].length);
  }

  *[Symbol.iterator](): IterableIterator<T> {
    const items = this[ITEMS];
    touch(this, LENGTH);

    for (let i = 0; i < items.length; i++) yield touch(this, i, items[i]);
  }

  map<U>(fn: List.Mapper<T, U>): U[];
  map<U, X extends U>(fn: List.Mapper<T, U>, ignore: X): Exclude<U, X>[];
  map<U>(fn: List.Mapper<T, U>, ignore?: U): U[] {
    const out: U[] = [];
    const skip = arguments.length > 1;
    let i = 0;

    for (const v of this) {
      const r = fn(v, i++, this);
      if (skip && r === ignore) continue;
      out.push(r);
    }

    return out;
  }

  filter(fn: List.Predicate<T>): T[] {
    const out: T[] = [];
    let i = 0;
    for (const v of this) if (fn(v, i++, this)) out.push(v);
    return out;
  }

  any(fn: List.Predicate<T>): boolean {
    const items = this[ITEMS];
    touch(this, LENGTH);
    return items.some((v, i) => fn(touch(this, i, v), i, this));
  }

  all(fn: List.Predicate<T>): boolean {
    const items = this[ITEMS];
    touch(this, LENGTH);
    return items.every((v, i) => fn(touch(this, i, v), i, this));
  }

  static from<T>(iterable: Iterable<T>): List<T> {
    return new List(iterable);
  }
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

export { List };
