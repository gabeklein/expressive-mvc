import { event, listener, Observable, touch } from './observable';

const ITEMS = Symbol('items');
const ALL = Symbol('all');

declare namespace List {
  type Predicate<T> = (value: T, index: number, list: List<T>) => boolean;
  type Mapper<T, U> = (value: T, index: number, list: List<T>) => U;
}

type AllMemo = {
  key: symbol;
  failing: Set<number>;
};

class List<T> implements Observable {
  declare [ITEMS]: T[];
  declare [ALL]: Map<List.Predicate<T>, AllMemo>;

  constructor(initial: Iterable<T> = []) {
    const items = (this[ITEMS] = [...initial]);
    const memos = (this[ALL] = new Map());

    listener(this, (k) => {
      if (typeof k !== 'number') return;

      for (const [pred, { failing, key }] of memos) {
        const wasOk = failing.size === 0;

        if (k < items.length && !pred(items[k], k, this)) failing.add(k);
        else failing.delete(k);

        if (!failing.size !== wasOk) event(this, key);
      }
    });

    event(this);
  }

  [Observable](callback: Observable.Callback) {
    const watching = new Set<Observable.Signal>();

    listener(this, (key) => {
      if (watching.has(key)) return callback();
    });

    return (key: Observable.Signal) => {
      watching.add(key);
    };
  }

  get size(): number {
    return touch(this, "size", this[ITEMS].length);
  }

  get(): T[];
  get(index: number): T | undefined;
  get(start: number, end: number): T[];
  get(predicate: List.Predicate<T>): T | undefined;
  get(predicate: List.Predicate<T>, all: true): T[];
  get(arg?: number | List.Predicate<T>, second?: number | boolean) {
    const items = this[ITEMS];

    if (arg === undefined) return items.map(exportValue);

    if (typeof arg === 'number') {
      if (typeof second !== 'number') return touch(this, arg, items[arg]);

      touch(this, "size", items.length);

      const stop = Math.min(second, items.length);
      const out: T[] = [];

      for (let i = arg; i < stop; i++) {
        out.push(touch(this, i, items[i]));
      }

      return out;
    }

    if (second) return this.filter(arg);

    let i = 0;
    for (const v of this) if (arg(v, i++, this)) return v;
  }

  set(index: number, value: T) {
    const items = this[ITEMS];

    if (items[index] === value) return;

    const grew = index >= items.length;
    items[index] = value;
    event(this, index);
    if (grew) event(this, "size");
  }

  put(index: number, ...items: T[]) {
    const arr = this[ITEMS];
    if (items.length) {
      const at =
        index < 0
          ? Math.max(arr.length + index, 0)
          : Math.min(index, arr.length);

      arr.splice(at, 0, ...items);

      for (let i = at; i < arr.length; i++) event(this, i);
      event(this, "size");
    }
    return arr.length;
  }

  push(...values: T[]): number {
    return this.put(this[ITEMS].length, ...values);
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
      event(this, "size");
    }

    return count === undefined ? removed[0] : removed;
  }

  clear() {
    this.pop(0, this[ITEMS].length);
  }

  *[Symbol.iterator](): IterableIterator<T> {
    const items = this[ITEMS];
    touch(this, "size", items.length);

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

  all(pred: List.Predicate<T>): boolean {
    const memos = this[ALL];
    let memo = memos.get(pred);

    if (!memo) {
      memos.set(
        pred,
        (memo = {
          key: Symbol("all"),
          failing: new Set()
        })
      );

      const items = this[ITEMS];
      for (let i = 0; i < items.length; i++)
        if (!pred(items[i], i, this)) memo.failing.add(i);
    }

    return touch(this, memo.key, memo.failing.size === 0);
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
