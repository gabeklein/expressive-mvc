import { join } from '../context';
import { def } from './def';
import { element } from '../element';
import { event, listener, touch } from '../observable';
import { Model, parent } from '../model';

const LENGTH = Symbol('length');
const SHAPE = Symbol('shape');

const ITEMS = new WeakMap<object, unknown[]>();
const MEMBERS = new WeakMap<object, Set<unknown>>();
const OWNED = new WeakMap<object, Map<unknown, () => void>>();
const MAKE = new WeakMap<object, Make>();

type Make = (...args: unknown[]) => unknown;

/** Test for a value - given the value, its position in iteration, and the collection. */
type Predicate<T> = (value: T, index: number, self: unknown) => boolean;

/** Transform of a value - given the value, its position in iteration, and the collection. */
type Mapper<T, U> = (value: T, index: number, self: unknown) => U;

declare namespace has {
  export { Predicate, Mapper, List, Pool, Create, From }
}

/**
 * Reactive list of values, by position - seeded from `initial` when given.
 *
 * `initial` is copied; falsy is empty. Values are stored, not owned - no adoption, destruction or
 * eviction; use a pool for owned Models. The field is read-only - assigning it throws. Cleared when
 * the owner is destroyed.
 *
 * @example
 * history = has<string>();
 *
 * record(entry: string) {
 *   this.history.push(entry);
 * }
 */
function has<T>(initial?: Iterable<T> | false | null): List<T>;

/**
 * Pool of `Type` members, spawned by `add` and owned - addressed by identity.
 *
 * `add(...args)` constructs as `Type.new()` takes them; `add(instance)` with a lone instance of
 * `Type` or a subclass holds it instead. Starts empty - seed it from `new()`. The field is
 * read-only - assigning it throws.
 *
 * @example
 * class Player extends Model {
 *   id = '';
 * }
 *
 * class Roster extends Model {
 *   players = has(Player);
 * }
 *
 * Roster.new().players.add({ id: 'abc' });
 */
function has<T extends Model>(
  Type: new (...args: Model.Args<T>) => T
): Create<T>;

/**
 * Pool of `Type` members, `add`'s one argument assigned to field `fromKey`.
 *
 * `add(value)` constructs `new Type({ [fromKey]: value })`; a lone instance of `Type` or a subclass
 * is held instead. One key only - more arguments need a factory.
 *
 * @example
 * class Cell extends Model {
 *   at = '';
 * }
 *
 * class Board extends Model {
 *   cells = has(Cell, 'at');
 * }
 *
 * Board.new().cells.add('a1'); // new Cell({ at: 'a1' })
 */
function has<T extends Model, K extends Model.Field<T>>(
  Type: new (...args: Model.Args<T>) => T,
  fromKey: K
): From<T, K>;

/**
 * Pool of members `make` returns from `add`'s arguments - addressed by identity.
 *
 * A nullish result adds nothing and `add` returns it - members stay non-nullable. A result already
 * present is returned untouched, so `make` may look up as well as create. Instances are never admitted
 * directly - `add`'s arguments are `make`'s own. A fresh Model result is owned, an active one a guest.
 *
 * @example
 * messages = has((dto: MessageDto) =>
 *   dto.deleted ? undefined : new Message({ info: dto })
 * );
 */
function has<R, A extends unknown[]>(
  make: (...args: A) => R
): Pool<Exclude<R, null | undefined>, A, R>;

function has(
  arg?: Iterable<unknown> | Function | false | null,
  fromKey?: string
): unknown {
  return def((_key, subject) => {
    const value =
      typeof arg == 'function' ? new Pool(arg, fromKey) : new List(arg);

    parent(value, subject);
    listener(subject, () => value.clear(), null);

    return { set: false, value };
  });
}

/**
 * Reactive list of values, by position - what `has()` and `has(values)` make.
 *
 * Reads track the positions they visit; writes notify each position they change or shift, plus
 * length on insertion or removal. Duplicates are allowed. Values are stored, not owned. A Model
 * read through a tracked list is tracked too. Constructible standalone - `new has.List(values)`.
 */
class List<T> {
  constructor(initial?: Iterable<T> | false | null) {
    ITEMS.set(this, initial ? Array.from(initial) : []);
    OWNED.set(this, new Map());

    event(this);
  }

  /** The instance to render - this, or the source behind a derived view. */
  get is(): this {
    return source(this);
  }

  /** Members to render, as a host sees them. */
  render(): T[] {
    return [...this];
  }

  /** Number of items - tracks length. */
  get size(): number {
    return touch(this, LENGTH, items<T>(this).length);
  }

  /**
   * Shallow snapshot array of the items - untracked.
   *
   * A value with a `get()` method exports through it, as Model snapshots do.
   */
  get(): Model.Export<T>[];

  /**
   * Item at `index` - negative counts from the end.
   *
   * Tracks that position only - a negative index resolves once, at read. Out of range returns
   * undefined and tracks length.
   */
  get(index: number): T | undefined;

  /**
   * Items from `start` up to, not including, `end`.
   *
   * Negative `start` counts from the end; `end` past the length is clamped. Tracks length and each
   * position returned.
   */
  get(start: number, end: number): T[];

  /** First item matching `predicate` - tracks length and positions up to the match. */
  get(predicate: Predicate<T>): T | undefined;
  get(arg?: number | Predicate<T>, second?: number): any {
    const values = items<T>(this);

    if (arg === undefined) return values.map(exportValue);

    if (typeof arg === 'function') return findOf(this, arg);

    if (typeof second !== 'number') {
      const at = arg < 0 ? values.length + arg : arg;

      return at < 0 || at >= values.length
        ? touch(this, LENGTH)
        : touch(this, at, values[at]);
    }

    touch(this, LENGTH);

    const start = arg < 0 ? Math.max(values.length + arg, 0) : arg;

    return values
      .slice(start, Math.min(second, values.length))
      .map((v, i) => touch(this, start + i, v));
  }

  /**
   * Replace the item at `index` - negative counts from the end.
   *
   * Notifies that position only. Out of range, or the same value, does nothing.
   */
  set(index: number, value: T) {
    const target = source(this);
    const values = ITEMS.get(target) as T[];
    const at = index < 0 ? values.length + index : index;

    if (at < 0 || at >= values.length || values[at] === value) return;

    values[at] = value;
    event(target, at);
  }

  /**
   * Insert values at `index`, shifting later items.
   *
   * Negative counts from the end, clamped to the start; past the end appends. Notifies every
   * shifted position and length. No values does nothing.
   */
  put(index: number, ...values: T[]) {
    if (!values.length) return;

    const target = source(this);
    const arr = ITEMS.get(target) as T[];
    const at =
      index < 0
        ? Math.max(arr.length + index, 0)
        : Math.min(index, arr.length);

    arr.splice(at, 0, ...values);

    for (let i = at; i < arr.length; i++) event(target, i);
    event(target, LENGTH);
  }

  /** Append values; returns the new length. */
  push(...values: T[]): number {
    this.put(items(this).length, ...values);
    return items(this).length;
  }

  /** Remove and return the last item - undefined when empty. */
  pop(): T | undefined;

  /**
   * Remove and return the item at `index` - negative counts from the end.
   *
   * A negative index past the start clamps to the first item; past the end returns undefined.
   * Notifies every shifted position and length.
   */
  pop(index: number): T | undefined;

  /**
   * Remove up to `count` items from `index`, returned as an array.
   *
   * `index` resolves as in `pop(index)`. Notifies every shifted position and length.
   */
  pop(index: number, count: number): T[];
  pop(index = -1, count?: number): T | T[] | undefined {
    const target = source(this);
    const values = ITEMS.get(target) as T[];
    const before = values.length;
    const start =
      index < 0 ? Math.max(before + index, 0) : Math.min(index, before);
    const removed = values.splice(start, count ?? 1);

    if (removed.length) {
      const end = Math.max(before, values.length);
      for (let i = start; i < end; i++) event(target, i);
      event(target, LENGTH);
    }

    return count === undefined ? removed[0] : removed;
  }

  /** Remove every item - also run when the owner is destroyed. */
  clear() {
    this.pop(0, items(this).length);
  }

  /** Items in order - tracks length and each position visited. */
  *[Symbol.iterator](): IterableIterator<T> {
    const values = items<T>(this);

    touch(this, LENGTH);

    for (let i = 0; i < values.length; i++) yield touch(this, i, values[i]);
  }

  /** Plain array of `fn` over each item - tracks as iteration does. */
  map<U>(fn: Mapper<T, U>): U[];

  /** Plain array of `fn` over each item, results `=== ignore` left out. */
  map<U, X extends U>(fn: Mapper<T, U>, ignore: X): Exclude<U, X>[];
  map<U>(fn: Mapper<T, U>, ignore?: U): U[] {
    return mapOf(this, fn, arguments.length > 1, ignore);
  }

  /** Plain array of items matching `fn` - tracks as iteration does. */
  filter(fn: Predicate<T>): T[] {
    return filterOf(this, fn);
  }

  /** Whether any item matches - stops at the first, tracking positions up to it. */
  any(fn: Predicate<T>): boolean {
    return anyOf(this, fn);
  }

  /** Whether every item matches - true when empty; stops at the first miss. */
  all(fn: Predicate<T>): boolean {
    return !anyOf(this, (v, i, self) => !fn(v, i, self));
  }
}

/** Pool of a Model class - `has(Type)`. Spawns from constructor arguments, or holds an instance. */
interface Create<T extends Model> extends Pool<T, Model.Args<T>> {
  /** Construct a member as `Type.new()` takes `args`, and add it. */
  add(...args: Model.Args<T>): T;

  /**
   * Add `instance` itself - a lone instance of the class or a subclass, never constructed over.
   *
   * Fresh, it is owned; already active, a guest. Only a lone argument is admitted.
   */
  add(instance: T): T;
}

/** Pool of a Model class keyed by one field - `has(Type, fromKey)`. */
interface From<T extends Model, K extends Model.Field<T>>
  extends Pool<T, [from: T[K]]> {
  /** Construct a member with `from` assigned to the key field, and add it. */
  add(from: T[K]): T;

  /**
   * Add `instance` itself - a lone instance of the class or a subclass, never constructed over.
   *
   * Fresh, it is owned; already active, a guest.
   */
  add(instance: T): T;
}

/**
 * Reactive set of members, by identity - what `has(Type)` and `has(make)` make.
 *
 * A fresh Model member is owned: parented to the pool's owner, activated in its context, destroyed
 * on `delete`, `clear` or the owner's death. An already-active one is a guest - held, never
 * destroyed. A Model member that dies evicts itself. Iteration follows insertion order. A Model read
 * through a tracked pool is tracked too. Constructible standalone - `new has.Pool(Type)` - owning
 * members without a context.
 */
class Pool<T, A extends unknown[] = unknown[], R = T> {
  constructor(make: Function, fromKey?: string) {
    if (Model.is(make)) {
      const Type = make as unknown as Model.Type;

      make = (...args: Model.Args) =>
        args.length == 1 && args[0] instanceof Type ? args[0] :
        fromKey ? new Type({ [fromKey]: args[0] }) :
        new Type(...args);
    }

    MEMBERS.set(this, new Set());
    MAKE.set(this, make as Make);
    OWNED.set(this, new Map());

    event(this);
  }

  /** The instance to render - this, or the source behind a derived view. */
  get is(): this {
    return source(this);
  }

  /** Members to render, as a host sees them. */
  render(): T[] {
    return [...this];
  }

  /** Number of members - tracks membership. */
  get size(): number {
    return touch(this, SHAPE, members<T>(this).size);
  }

  /**
   * Make a member from `args` and add it; returns what was made.
   *
   * A value already present is returned without a duplicate or event. A nullish result from a
   * factory adds nothing. Adding a destroyed Model throws. Notifies that member and membership.
   */
  add(...args: A): R {
    const target = source(this);
    const made = MAKE.get(target)!(...args) as T | null | undefined;

    if (made == null) return made as R;

    const values = MEMBERS.get(target) as Set<T>;

    if (!values.has(made)) {
      values.add(made);
      adopt(target, made, made);
      event(target, made as never);
      event(target, SHAPE);
    }

    return made as R;
  }

  /**
   * Shallow snapshot array of the members - untracked.
   *
   * A value with a `get()` method exports through it, as Model snapshots do.
   */
  get(): Model.Export<T>[];

  /** First member matching `predicate` - tracks membership and members up to the match. */
  get(predicate: Predicate<T>): T | undefined;
  get(predicate?: Predicate<T>): any {
    return predicate
      ? findOf(this, predicate)
      : Array.from(members<T>(this), exportValue);
  }

  /** Whether `value` is a member - tracks that value only. */
  has(value: T): boolean {
    return touch(this, value, members<T>(this).has(value));
  }

  /**
   * Remove `value`; false if it was not a member.
   *
   * Destroys an owned member. Notifies that member and membership.
   */
  delete(value: T): boolean {
    const target = source(this);
    const values = MEMBERS.get(target) as Set<T>;

    if (!values.has(value)) return false;

    release(target, value);
    values.delete(value);

    event(target, value as never);
    event(target, SHAPE);

    return true;
  }

  /** Remove every member, destroying owned ones - also run when the owner is destroyed. */
  clear() {
    const target = source(this);
    const values = MEMBERS.get(target) as Set<T>;

    if (!values.size) return;

    const removed = Array.from(values);

    for (const value of removed) release(target, value);

    values.clear();

    for (const value of removed) event(target, value as never);
    event(target, SHAPE);
  }

  /** Members in insertion order - tracks membership and each member visited. */
  *[Symbol.iterator](): IterableIterator<T> {
    const values = members<T>(this);

    touch(this, SHAPE);

    for (const value of values) yield touch(this, value, value);
  }

  /** Plain array of `fn` over each member - tracks as iteration does. */
  map<U>(fn: Mapper<T, U>): U[];

  /** Plain array of `fn` over each member, results `=== ignore` left out. */
  map<U, X extends U>(fn: Mapper<T, U>, ignore: X): Exclude<U, X>[];
  map<U>(fn: Mapper<T, U>, ignore?: U): U[] {
    return mapOf(this, fn, arguments.length > 1, ignore);
  }

  /** Plain array of members matching `fn` - tracks as iteration does. */
  filter(fn: Predicate<T>): T[] {
    return filterOf(this, fn);
  }

  /** Whether any member matches - stops at the first, tracking members up to it. */
  any(fn: Predicate<T>): boolean {
    return anyOf(this, fn);
  }

  /** Whether every member matches - true when empty; stops at the first miss. */
  all(fn: Predicate<T>): boolean {
    return !anyOf(this, (v, i, self) => !fn(v, i, self));
  }
}

function source<T extends object>(from: T): T {
  return OWNED.has(from) ? from : Object.getPrototypeOf(from);
}

function adopt(
  target: { delete(key: never): boolean },
  key: unknown,
  value: unknown
) {
  if (!(value instanceof Model)) return;

  const owner = parent(target as object);
  const fresh = parent(value, owner ?? null);
  const evict = listener(value, () => void target.delete(key as never), null);

  let detach: (() => void) | undefined;

  if (fresh && owner)
    detach = join(owner, value);

  OWNED.get(target)!.set(key, () => {
    evict();
    if (detach) detach();
    if (fresh) value.set(null);
  });

  if (fresh) event(value);
}

function release(target: object, key: unknown) {
  const owned = OWNED.get(target)!;
  const free = owned.get(key);

  if (free) {
    owned.delete(key);
    free();
  }
}

function exportValue(value: any) {
  return value && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value;
}

function items<T>(from: object): T[] {
  return ITEMS.get(source(from)) as T[];
}

function members<T>(from: object): Set<T> {
  return MEMBERS.get(source(from)) as Set<T>;
}

function findOf<T>(
  self: Iterable<T>,
  fn: Predicate<T>
): T | undefined {
  let i = 0;

  for (const value of self)
    if (fn(value, i++, self)) return value;
}

function anyOf<T>(self: Iterable<T>, fn: Predicate<T>): boolean {
  let i = 0;

  for (const value of self)
    if (fn(value, i++, self)) return true;

  return false;
}

function mapOf<T, U>(
  self: Iterable<T>,
  fn: Mapper<T, U>,
  skip: boolean,
  ignore?: U
): U[] {
  const out: U[] = [];
  let i = 0;

  for (const value of self) {
    const result = fn(value, i++, self);
    if (skip && result === ignore) continue;
    out.push(result);
  }

  return out;
}

function filterOf<T>(self: Iterable<T>, fn: Predicate<T>): T[] {
  const out: T[] = [];
  let i = 0;

  for (const value of self) if (fn(value, i++, self)) out.push(value);

  return out;
}

Object.assign(has, { List, Pool });

element(List);
element(Pool);

export { has };
