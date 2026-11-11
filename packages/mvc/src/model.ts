import { Context, home, host, join, within } from './context';
import { CAUSE, REPORT } from './dispatch';
import {
  capture,
  event,
  listener,
  Observer,
  observer,
  queued,
  REFRESH,
  touch,
  watch
} from './observable';
import { access, apply, compute, entries, HELD, manage, store, values, type Config } from './store';

const define = Object.defineProperty;

/** Register for all active states via string identifiers (usually unique). */
const ID = new WeakMap<Model, string>();

/** Models under construction - added on `new`, removed when activated or released.
 *  Also carries work to run at the deadline, which `def` uses to bound its registry. */
const PENDING = new Set<Model | (() => void)>();

/** External lifecycle listeners for any given Model class. */
type Handler = Model.On<any>;

const SETUP = new WeakMap<Model.Extends, Set<Handler>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<object, Model | null>();

/** Reference bound instance methods, or their getter, to real one. */
const UNBIND = new WeakMap<any, any>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** List of reactive getters defined by a given type. */
const GETTERS = new WeakMap<Function, Map<string, () => unknown>>();

/** Replacement for a getter captured by live computed properties, for hot patching. */
const LATEST = new WeakMap<Function, Function>();

/** Whether the deadline which drains `PENDING` is already queued for this tick. */
let QUEUED = false;

/** Global list each loaded copy of this module adds its `Model` to, on first construction. */
const COPIES = Symbol.for('@expressive/mvc');

let ANNOUNCED = false;

/** Adopters for managed properties which have held a child Model. */
const ADOPT = new WeakMap<Model, Map<unknown, (value: unknown) => void>>();
const CHILDREN = new WeakMap<Model, Set<(child: Model) => void>>();
const OWNS = new WeakMap<Model, Set<Model>>();

/** Instances mid-activation. */
const ACTIVE = new WeakMap<Model, { waits: Promise<unknown>[]; held: boolean; children: (() => void)[] }>();
const OWNED = new WeakMap<Model, Set<(child: Model) => void>>();

type Got<C extends { get(...args: any[]): any }> = ReturnType<C['get']> extends infer R
  ? NonNullable<R> extends Model
    ? C extends abstract new (...args: any[]) => infer I ? I | Extract<R, undefined> : R
    : R
  : never;

type Keyed<C extends { get(...args: any[]): any }> = [
  key: Exclude<Parameters<C['get']>[0], boolean | Function | undefined>,
  ...rest: Parameters<C['get']> extends [any?, ...infer R] ? R : []
];

type Overlay<T> = Record<string, unknown> & {
  [K in Model.Property<T>]?: T[K] extends (...args: infer A) => infer R
  ? (this: T, ...args: A) => R
  : T[K];
};

declare namespace Model {
  /** Any Model class, abstract included - for parameters which accept a class. */
  type Extends<T extends Model = Model> = (abstract new (...args: any[]) => T) &
    typeof Model;

  /** A concrete Model class - for parameters which construct one. */
  type Type<T extends Model = Model> = (new (...args: Model.Args<T>) => T) &
    Omit<typeof Model, never>;

  /**
   * Constructor arguments - overlays, init callbacks, contexts and nested arrays, applied in order.
   *
   * Arrays flatten. The first `Context` homes the instance - ignored when it has an owner or a home already.
   */
  type Args<T extends Model = any> = (Args<T> | Init<T> | Overlay<T> | Context | void)[];

  /**
   * Init callback in constructor args - runs at activation, in argument order, before `new()`.
   *
   * `this` and the argument are the instance. May return a cleanup (runs on destroy), more args, a plain
   * object to assign, or a promise - `ready` and effects wait for it; a rejection reports to `catch` as
   * `setup` and destroys the instance. A returned `Context` is ignored.
   */
  type Init<T extends Model = Model> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Overlay<T> | void;

  /** Lifecycle handlers for `Model.on`, keyed by stage. */
  interface On<T extends Model = Model> {
    /**
     * Per class, once, when first constructed - before its members are classified and bound.
     *
     * Given the class, so it may reshape the prototype. Runs for each subclass of the class registered on.
     */
    type?(type: Model.Extends<T>): void;

    /**
     * Per instance, at activation - before own values are observed, constructor args and `new()`.
     *
     * May return what an {@link Model.Init} callback may: cleanup, args, an overlay, or a promise which holds `ready`.
     */
    setup?(this: T, self: T): void | (() => void) | Promise<void> | Args<T> | Overlay<T>;

    /**
     * Per instance, once ready - args applied, `new()` run, and every promise they returned resolved.
     *
     * Skipped if setup rejects or the instance is destroyed first. May return a cleanup.
     */
    ready?(this: T, self: T): void | (() => void);

    /**
     * Each time a method binds to an instance - first read, a replacement, the rebind after a hot patch.
     *
     * Given the key and the bound function. Not run for `_` methods, which never bind. Tooling use.
     */
    method?(this: T, key: string, fn: Function, self: T): void;

    /**
     * Receives what an instance threw out of turn, with `kind` and the `key` where one applies.
     *
     * Kinds: `effect`, `getter`, `setup` (async construction), `dead` (a write after destroy), `unused`
     * (never activated). Most-derived class first, last registered first, each handler once. Return the
     * error (or another) to pass it on; return nothing to handle it; throw to escape uncaught. Passed off
     * the end, `dead` outputs nothing, `unused` warns, anything else escapes uncaught.
     */
    catch?(this: T, error: unknown, kind: 'effect' | 'getter' | 'setup' | 'dead' | 'unused', key?: string): unknown;
  }

  /** Values to merge with `set()` - unknown keys type-check, then are ignored; methods get `this`. */
  type Assign<T> = Record<string, unknown> & {
    [K in Property<T>]?: T[K];
  } & ThisType<T>;

  /** Keys of `T` not inherited from Model. **/
  type Property<T> = Exclude<keyof T, keyof Model>;

  /** Managed keys - `Property<T>` less `_` keys and `then`. **/
  type Field<T> = Exclude<Property<T>, `_${string}` | 'then'>;

  /** A key `set()` can dispatch or listen to - a field, or any custom string, number or symbol. */
  type Event<T = Model> = Field<T> | number | symbol | (string & {});

  /** What a listener receives - an event, or `true` ready, `false` flush done, `null` destroyed. */
  type Signal<T = Model> = Event<T> | true | false | null;

  /** Exported form of a value - a Model as its `Values`, anything with `get()` as what that returns. */
  type Export<R> = R extends Model
    ? Values<R>
    : R extends { get(): infer T }
    ? T
    : R;

  /** Plain snapshot of managed fields, child Models and `ref`-like values unwrapped - from `get()`. */
  type Values<T> = { [P in Field<T>]: Export<T[P]> };

  /** Some fields of `T`, in exported form. */
  type Partial<T> = { [P in Field<T>]?: Export<T[P]> };

  /** Exported value of one field, `unknown` for a custom event. */
  type Value<T extends Model, K extends Model.Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => T | void;

  /** Descriptor for a managed property - `value`, `get`, `set`, `enumerable`. */
  type Apply<T = any> = Config<T, Model>;

  /** Descriptor for `set(key, config)` - typed by the field when `key` is one. */
  type Define<T, K> = K extends Field<T> ? Apply<T[K] | Export<T[K]>> : Apply;

  /**
   * Listener for `set(callback)` and `set(key, callback)` - given the key and the instance.
   *
   * Return `null` to unsubscribe; return a function to run it when the batch settles.
   */
  type OnEvent<T extends Model> = (
    this: T,
    key: Signal<T>,
    source: T
  ) => void | (() => void) | null;

  /** Callable ref holding `current`. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  };

  /**
   * Effect for `get(effect)` - re-runs when what it read through `current` changes.
   *
   * `this` and `current` are the tracking proxy. `update` holds keys changed since the last run - empty on
   * the first. Return a cleanup, `null` to cancel after this run, or a promise.
   */
  type Effect<T, R = EffectCallback | Promise<void> | null | void> = (
    this: T,
    current: T,
    update: readonly Model.Event<T>[] | undefined
  ) => R;

  /**
   * Stops an effect. Await it instead to stop once a run completes and receive that run's value.
   *
   * Rejects if the instance is destroyed before a clean run, or the run throws.
   */
  type Release<R = void> = (() => void) & PromiseLike<R>;

  /** Effect cleanup - given `true` before a re-run, `false` when cancelled, `null` when destroyed. */
  type EffectCallback = (update: boolean | null) => void;

  /** Keys updated in the pending batch - awaitable for the full list once the batch flushes. */
  type Updated<T extends Model> = readonly Event<T>[] &
    PromiseLike<readonly Event<T>[]>;
}

/**
 * Reactive state as a class - fields observable, methods bound, getters computed.
 *
 * Writes batch and dispatch on a microtask; a write `===` the current value is skipped. `Model.new()`
 * constructs and activates - bare `new` only constructs, fine for a child held in a field, which its
 * parent activates; an instance never activated warns. `_` keys and `then` are unmanaged.
 *
 * @example
 * class Counter extends Model {
 *   count = 0;
 *
 *   increment() {
 *     this.count++;
 *   }
 * }
 *
 * const counter = Counter.new({ count: 10 });
 */
abstract class Model {

  /**
   * The instance itself - unwraps a tracking proxy; reads through it do not subscribe.
   *
   * Each tracked read of a child returns a fresh proxy - compare and store instances through `is`.
   *
   * @example
   * const { is: counter, count } = Counter.get();
   */
  declare is: this;

  constructor(...args: Model.Args) {
    define(this, 'is', { value: this });
    init(this, args, this.new);
  }

  /**
   * Lifecycle hook - runs once at activation, after fields, child Models and constructor args.
   *
   * `this` is the instance. Return a cleanup to run on destroy. Async: `ready` handlers and effects wait
   * for it; a rejection reports to `catch` as `setup` and destroys the instance. Runs wherever the
   * instance is built, the server included - put browser-only work in an effect. An instance field
   * named `new` is ignored.
   *
   * @example
   * protected new() {
   *   const id = setInterval(() => this.tick(), 1000);
   *   return () => clearInterval(id);
   * }
   */
  protected new?(): void | (() => void) | Promise<void>;

  /**
   * Snapshot of every managed value - frozen, child Models and `ref`-like values exported.
   *
   * Non-enumerable fields included; a field with no value yet is absent. Circular children export once.
   */
  get(): Model.Values<this>;

  /**
   * Run an effect now and again whenever a value it read through `current` changes.
   *
   * Changes in one batch re-run it once. Reads through `this` (the proxy) track; reads inside methods
   * it calls do not. Before the instance is ready, the first run waits. A thrown suspense retries once it
   * resolves. Throws if the instance is destroyed.
   *
   * @example
   * this.get(($) => {
   *   document.title = `${$.count} items`;
   * });
   */
  get(effect: Model.Effect<this>): Model.Release;

  /**
   * Run an async effect, again on change - awaiting the release stops it and yields the run's value.
   *
   * Changes while a run is pending re-run it once, after it settles, with every changed key. A rejection
   * reports to `catch` as `effect` unless the release is awaited.
   *
   * @example
   * const user = await this.get(async ($) => $.user);
   */
  get<R>(effect: Model.Effect<this, Promise<R>>): Model.Release<R>;

  /**
   * Value of a field - suspends until it has one; `ref`-like values unwrap through their `get()`.
   *
   * No value yet: throws a suspense promise resolving with it - `required: false` returns `undefined`.
   * A stored `undefined` throws only with `required: true`. Destroyed, returns `undefined`. A method's
   * name returns the original, unbound method. Does not subscribe, even on a tracking proxy.
   *
   * @example
   * const token = this.get('token', false);
   */
  get<T extends Model.Event<this>>(
    key: T,
    required?: boolean
  ): Model.Value<this, T>;

  /** Whether the instance is destroyed. */
  get(status: null): boolean;

  /**
   * Run a callback when the instance is destroyed.
   *
   * Throws if it already is. Returns a function to remove the callback.
   */
  get(status: null, callback: () => void): () => void;

  /**
   * Nearest instance of a class in this instance's context - throws if none.
   *
   * Skips this instance. Calls `Type.get()` from here, so an overridden static `get` applies. Through a
   * tracking proxy, reads off the result subscribe and the lookup follows its provider. Throws
   * `Could not find {Type} in context.`
   *
   * @example
   * const theme = this.get(Theme);
   */
  get<T extends Model>(type: Model.Type<T>, required?: true): T;

  /** Nearest instance of a class in this instance's context, or `undefined`. */
  get<T extends Model>(type: Model.Type<T>, required: boolean): T | undefined;

  /**
   * Run a callback for each instance of a class in context - present now, then as each arrives.
   *
   * Searches above and below by default; `downstream: true` only below, `false` only above. The callback
   * gets the instance and whether it was found below. For an instance arriving later, a returned function
   * runs when it leaves. Returns a function to stop watching.
   */
  get<T extends Model>(
    type: Model.Type<T>,
    callback: Context.Expect<T>,
    downstream?: boolean
  ): () => void;

  // Owner overloads take `Model` itself only - a subclass would otherwise match
  // them in TypeScript's subtype pass, before the `Model.Type<T>` overloads.

  /**
   * Owner of this instance, passing `Model` - throws if it has none.
   *
   * The owner constructed it into a field, `has()` or `map()`; failing that, the instance its nearest
   * context was set up for. Fixed at activation, not reactive. A root, or an instance already active
   * when something held it, has none. Throws `{instance} has no owner.`
   *
   * @example
   * const owner = this.get(Model);
   */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    required?: true
  ): Model;

  /** Owner of this instance, passing `Model` - or `undefined`. */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    required: boolean
  ): Model | undefined;

  /**
   * Run a callback for each Model this one owns, passing `Model` - owned now, then each as it activates.
   *
   * Direct children only. A returned function runs when that child is destroyed. Returns a function to
   * stop watching.
   *
   * @example
   * this.get(Model, (child) => console.log(child), true);
   */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    callback: (child: Model) => void | (() => void),
    downstream: true
  ): () => void;

  /**
   * Call `Type.get(...args)` from this instance - its context, tracked when this is a tracking proxy.
   *
   * For a class overriding static `get` with its own arguments - typed by the override.
   *
   * @example
   * const user = this.get(User, 5);
   */
  get<C extends Model.Extends>(Type: C, ...args: Keyed<C>): Got<C>;

  get(
    arg1?: Model.Effect<this> | Model.Type | typeof Model | string | null,
    arg2?: boolean | Context.Expect | (() => void),
    ...args: any[]
  ) {
    const self = this.is;

    if (arg1 === undefined) return values(self);
    if (arg1 === Model)
      return typeof arg2 == 'function'
        ? owned(self, arg2 as (child: Model) => void)
        : observed(this, arg1, owner(self, arg2 as boolean));
    if (Model.is(arg1))
      return typeof arg2 == 'function'
        ? Context.get(self).get(arg1, arg2, args[0], self)
        : within(this, () => (arg1.get as Function)(arg2, ...args));
    if (typeof arg1 == 'function')
      return watch(self, function (current, update) {
        const { wait } = observer(self, true);

        if (wait) throw new Promise<void>((resolve) => wait.add(resolve));

        return unbind(arg1).call(this, current, update);
      });
    if (typeof arg2 == 'function') return callback(self, arg2, arg1);
    if (arg1 === null) return observer(self) === null;
    if (arg2 !== false && !(arg1 in store(self)) && METHODS.get(self.constructor)!.has(arg1))
      return unbind((self as any)[arg1]);

    return access(self, arg1, arg2);
  }

  /**
   * Keys updated in the pending batch - await for the full list once it flushes; empty if none.
   *
   * Activates an instance built with bare `new`. Waits on this instance only - `pending(work)` waits out
   * the cascade a write sets off.
   *
   * @example
   * const keys = await this.set();
   */
  set(): Model.Updated<this>;

  /**
   * Merge values into the instance - fields, `_` keys and methods; other keys are ignored.
   *
   * Computed getters, `is` and `then` are skipped. `undefined` and `null` present do write. `silent`
   * skips dispatch and the destroyed-write report. Returns the pending batch, as `set()`.
   *
   * @example
   * counter.set({ count: 0, label: 'reset' });
   */
  set(assign?: Model.Assign<this>, silent?: boolean): Model.Updated<this>;

  /**
   * Listen to every dispatched key - each changing write and each explicit event, synchronously.
   *
   * Not called for ready, flush or destroy. Return `null` to unsubscribe; return a function to run it
   * once when the batch settles - the same function returned for several keys runs once. Returns a
   * remover, `true` if it removed the listener. Throws if the instance is destroyed.
   *
   * @example
   * this.set((key) => console.log('updated', key));
   */
  set(callback: Model.OnEvent<this>): () => boolean;

  /**
   * Dispatch an update without changing a value - a field mutated in place, or a custom event.
   *
   * Any string, number or symbol is an event - keep custom names clear of field names.
   *
   * @example
   * this.items.push(item);
   * this.set('items');
   */
  set(key: Model.Event<this>): Model.Updated<this>;

  /**
   * Destroy the instance - owned children first, then destroy listeners, cleanups and `new()`'s cleanup.
   *
   * Dispatch stops. Later writes are stored without dispatch and reported to `catch` as `dead`.
   * Subscribing then throws. Repeat calls do nothing.
   */
  set(status: null): void;

  /**
   * Listen to one key or event; `null` listens for destroy.
   *
   * Return `null` to unsubscribe; return a function to run it once when the batch settles. Returns a
   * remover. Throws if the instance is destroyed.
   *
   * @example
   * this.set('count', () => console.log('count changed'));
   */
  set<K extends Model.Event<this>>(
    event: K | null,
    callback: Model.OnEvent<this>
  ): () => boolean;

  /**
   * Define a managed property from a descriptor, or update a managed one's value.
   *
   * A new key becomes reactive and trackable. On a managed key, only `value` is accepted - it writes
   * past any setter; other fields throw `Property {key} on {instance} is already defined.` A child
   * Model given as `value` is adopted.
   *
   * @example
   * state.set('label', { value: 'draft', set: false });
   */
  set<K extends Model.Event<this>>(
    key: K,
    config: Model.Define<this, K>
  ): Model.Updated<this>;

  set(
    arg1?: Model.OnEvent<this> | Model.Assign<this> | Model.Event<this> | null,
    arg2?: unknown
  ) {
    const self = this.is;

    if (typeof arg1 == 'function')
      return listener(self, (key) => {
        if (
          typeof key == 'string' ||
          typeof key == 'number' ||
          typeof key == 'symbol' && key !== REFRESH
        )
          return arg1.call(self, key, self);
      });

    if (typeof arg2 == 'function')
      return callback(self, arg2, arg1 as Model.Signal);

    if (arg1 && typeof arg1 == 'object') assign(self, arg1, arg2 === true);
    else if (arg2) apply(self, arg1 as string, arg2);
    else event(self, arg1);

    return queued(self) as Model.Updated<this>;
  }

  /** Iterate `[key, value]` over managed properties - stored values, not exported. */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return entries(this.is)[Symbol.iterator]();
  }

  /**
   * Construct and activate an instance - unlike `new`, which only constructs.
   *
   * Args apply in order: objects assign, functions run as init callbacks, the first `Context` homes it.
   * Effects and `ready` wait for any async setup.
   *
   * @example
   * const counter = Counter.new({ count: 10 }, (self) => () => console.log('destroyed', self));
   */
  static new<T extends Model>(this: Model.Type<T>, ...args: Model.Args<T>): T {
    const instance = new this(...args);
    event(instance);
    return instance;
  }

  /**
   * Instance of this class from context - throws `Could not find {Type} in context.` if none.
   *
   * In a host render, the render's context, tracked. Through `instance.get(Type)` or the `get`
   * instruction, that instance's context. Elsewhere, the root context, untracked.
   *
   * Override with one signature to accept a key - handle it with `Context.get(this, compute)`, once and
   * synchronously, and pass base forms to `super.get()`.
   *
   * @example
   * class User extends Model {
   *   id = 0;
   *
   *   static get<T extends User>(this: Model.Extends<T>, id?: T['id'] | false): T {
   *     if (typeof id != 'number') return (id === false ? super.get(false) : super.get()) as T;
   *
   *     return Context.get(this, (context) => {
   *       const found = context.get(this, false);
   *       return found?.id === id ? found : undefined;
   *     }) as T;
   *   }
   * }
   */
  static get<T extends Model>(this: Model.Extends<T>): T;

  /** Instance of this class from context, or `undefined`. */
  static get<T extends Model>(this: Model.Extends<T>, required: false): T | undefined;

  static get(this: Model.Extends, required?: false): any {
    return Context.get(this, (context, from) => {
      const found = context.get(this, required !== false, undefined, from);

      if (found || required === false) return found || undefined;

      throw new Error(`Could not find ${this} in context.`);
    });
  }

  /**
   * Whether a value is this class or a subclass of it - a type guard.
   *
   * Compares classes, not instances - use `instanceof` for those.
   *
   * @example
   * if (Counter.is(Type)) Type.new();
   */
  static is<T extends Model.Extends>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  /**
   * Register a `setup` handler for every instance of this class and its subclasses.
   *
   * Runs at activation, before own values are observed - see {@link Model.On.setup}. Returns a remover.
   *
   * @example
   * Counter.on((self) => () => console.log('destroyed', self));
   */
  static on<T extends Model>(
    this: Model.Extends<T>,
    setup: NonNullable<Model.On<T>['setup']>
  ): () => boolean;

  /**
   * Register lifecycle handlers for every instance of this class and its subclasses, keyed by stage.
   *
   * Stages: `type`, `setup`, `ready`, `method`, `catch` - see {@link Model.On}. Ancestor classes' handlers
   * run first; a function registered more than once runs once per stage. Returns a remover.
   *
   * @example
   * Counter.on({
   *   ready() {
   *     console.log('ready', this);
   *   }
   * });
   */
  static on<T extends Model>(
    this: Model.Extends<T>,
    handler: Model.On<T>
  ): () => boolean;

  static on<T extends Model>(
    this: Model.Extends<T>,
    handler: Model.On<T> | NonNullable<Model.On<T>['setup']>
  ) {
    if (typeof handler == 'function') handler = { setup: handler };

    return subscribe(SETUP, this, handler);
  }
}

define(Model.prototype, 'toString', {
  value() {
    return ID.get(this.is);
  }
});

define(Model, 'toString', {
  value() {
    return this.name;
  }
});

function observed<T>(from: Model, key: unknown, value: T): T {
  return value instanceof Model ? touch(from, key, value) : value;
}

/** Register a user OnEvent callback, preserving `this` and `source`. */
function callback<T extends Model>(
  self: T,
  cb: Function,
  select?: Observer.Signal | Set<Observer.Signal>
) {
  return listener(self, (key) => cb.call(self, key, self), select);
}

/**
 * Apply state arguments, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(state: Model, ...args: Model.Args) {
  const T = state.constructor as Model.Extends;

  if (T === Model) throw new Error('Cannot create base Model.');

  if (!ANNOUNCED) {
    ANNOUNCED = true;
    ((globalThis as { [COPIES]?: unknown[] })[COPIES] ||= []).push(Model);
  }

  const { before, after } = bootstrap(T);

  ID.set(state, `${T}-${uid()}`);

  listener(state, (key) => {
    const rest = trailing(state);

    PENDING.delete(state);

    if (key === null) return null;

    activate(state, args, before, after);

    let end = rest.length;

    while (end-- > 0 && PENDING.has(rest[end]));

    for (let i = 0; i < end; i++) PENDING.delete(rest[i]);

    return null;
  });

  if (!QUEUED) {
    QUEUED = true;

    queueMicrotask(() => {
      QUEUED = false;

      for (const item of PENDING)
        if (typeof item == 'function') item();
        else report('unused', item, new Error(`${item} was constructed but never activated.`));

      PENDING.clear();
    });
  }

  PENDING.add(state);
}

/**
 * Bring a Model up within its parent and context - run setup handlers and
 * arguments, then settle it now, after its own async setup, or with a parent
 * still holding.
 */
function activate(
  state: Model,
  args: Model.Args,
  before: Set<Model.Init>,
  after: Set<NonNullable<Model.On['ready']>>
) {
  const waits: Promise<unknown>[] = [];
  const children: (() => void)[] = [];
  const active = { waits, children, held: false };

  function observe() {
    if (waits.length) active.held = true;

    manage(state);
  }

  function settle() {
    const o = observer(state, true);
    const { wait } = o;

    o.wait = undefined;
    children.forEach((release) => release());

    capture((release) => {
      listener(state, () => release(null), null);

      for (const handler of after) {
        const out = handler.call(state, state);

        if (typeof out == 'function') listener(state, out, null);
      }
    });

    wait?.forEach((resolve) => resolve());
  }

  args.forEach(function find(arg) {
    if (Array.isArray(arg)) arg.forEach(find);
    else if (arg instanceof Context) home(state, arg);
  });

  if (!PARENT.has(state)) parent(state, host(state) || null);

  const above = PARENT.get(state);
  const owns = above && (OWNS.get(above) || OWNS.set(above, new Set()).get(above)!);
  const up = above ? ACTIVE.get(above) : undefined;

  if (owns) listener(state, () => void owns.delete(state), null);

  active.held = !!up?.held;
  ACTIVE.set(state, active);

  const o = observer(state, true);

  try {
    capture((release) => {
      const queue = [...before, observe, ...args];

      listener(state, () => release(null), null);

      for (let i = 0; i < queue.length; i++) {
        const arg = queue[i];
        const called = typeof arg == 'function';
        const out = called ? arg.call(state, state) : arg;

        if (out instanceof Context) continue;

        if (out instanceof Promise) {
          waits.push(out);
          out.catch((err) => report('setup', state, err));
        } else if (Array.isArray(out)) queue.splice(i + 1, 0, ...out);
        else if (typeof out == 'function') listener(state, out, null);
        else if (called ? plain(out) : typeof out == 'object') assign(state, out as Model.Assign<Model>, true);
      }
    });
  } catch (error) {
    ACTIVE.delete(state);
    o.pending.clear();
    (state as { [Observer]?: Observer | null })[Observer] = o;
    event(state, null);
    throw error;
  }

  const settled = waits.length ? Promise.all(waits) : undefined;
  const hold = active.held || !!settled;
  const failed = (error: unknown) => {
    CAUSE.set(state, error);
    event(state, null);
  };
  const release = () => {
    if (observer(state) !== null) settle();
  };

  ACTIVE.delete(state);

  if (hold) observer(state, true).wait = new Set();

  if (up && hold) {
    if (settled) up.waits.push(settled.then(undefined, failed));
    up.children.push(release);
  }
  else if (settled) settled.then(release, failed);
  else settle();

  if (owns) {
    owns.add(state);
    OWNED.get(above)?.forEach((cb) => cb(state));
  }
}

/**
 * Apply instructions and inherited event listeners. Ensure class metadata is ready.
 *
 * @param T - Model class to bootstrap.
 * @return Array of init functions to run on instance, in order of class hierarchy.
 */
function bootstrap(T: Model.Extends) {
  const chain = [] as Model.Extends[];
  const before = new Set<Model.Init>();
  const after = new Set<NonNullable<Model.On['ready']>>();
  const onType = new Set<NonNullable<Model.On['type']>>();
  let keys = new Map<string, (value: any) => void>();
  let getters = new Map<string, () => unknown>();

  while (true) {
    chain.unshift(T);
    if (T === Model) break;
    T = Object.getPrototypeOf(T);
  }

  for (const type of chain) {
    for (const handler of SETUP.get(type) || []) {
      if (handler.setup) before.add(handler.setup);
      if (handler.ready) after.add(handler.ready);
      if (handler.type) onType.add(handler.type);
    }

    if (type === Model) continue;

    if (METHODS.has(type)) {
      keys = METHODS.get(type)!;
      getters = GETTERS.get(type)!;
      continue;
    }

    for (const setupType of onType) setupType(type);

    if (Object.prototype.hasOwnProperty.call(type, 'global'))
      throw new Error(
        `${type.name} declares \`static global\`, which was removed - provide it with <Component for>, or create it with .new(Context.root).`
      );

    METHODS.set(type, (keys = new Map(keys)));
    GETTERS.set(type, (getters = new Map(getters)));

    classify(type, keys, getters);
  }

  if (getters.size)
    before.add((self) => getters.forEach(getter, self));

  return { before, after };
}

/** Bind own configurable methods of a type and collect its reactive getters. */
function classify(
  type: Model.Extends,
  keys: Map<string, (value: any) => void>,
  getters: Map<string, () => unknown>
) {
  for (const [key, desc] of Object.entries(
    Object.getOwnPropertyDescriptors(type.prototype)
  )) {
    if (key == 'constructor' || !desc.configurable) continue;

    const { get, set } = desc;

    if (key[0] == '_' && (get || set)) {
      define(type.prototype, key, {
        ...desc,
        get: get && function (this: Model) { return get.call(this.is || this) },
        set: set && function (this: Model, value: unknown) { set.call(this.is || this, value) }
      });

      continue;
    }

    if (typeof get == 'function') {
      if (typeof set != 'function') getters.set(key, get);

      continue;
    }

    const { value } = desc;

    if (typeof value !== 'function') continue;

    if (key[0] == '_') {
      function run(this: Model, ...args: unknown[]) { return value.apply(this.is || this, args) }

      UNBIND.set(run, value);
      define(type.prototype, key, { ...desc, value: run });

      continue;
    }

    function bind(this: Model, original?: Function) {
      const { is } = this;

      if (is.hasOwnProperty(key) && !original) return value as Function;

      const fn = original || value;
      const bound = fn.bind(is);

      UNBIND.set(bound, fn);
      define(is, key, { value: bound, writable: true, configurable: true });

      for (const handler of stages(is.constructor as Model.Extends, 'method')) handler.call(is, key, bound, is);

      return bound;
    }

    UNBIND.set(bind, value);

    keys.set(key, bind);
    define(type.prototype, key, { get: bind, set: bind });
  }
}

/** Handlers of one stage along the class chain - ancestor first, in registration order, each once. */
function stages<K extends 'method' | 'catch'>(T: Model.Extends, key: K): Set<NonNullable<Model.On[K]>> {
  const found = T === Model ? new Set<NonNullable<Model.On[K]>>() : stages(Object.getPrototypeOf(T), key);

  for (const handler of SETUP.get(T) || []) if (handler[key]) found.add(handler[key]!);

  return found;
}

/** Install a prototype getter as a computed property, following its hot-patched replacements. */
function getter(this: Model, get: Function, key: string) {
  compute(this, key, function (this: Model, self: Model) {
    let latest = get;

    for (let next; (next = LATEST.get(latest)); ) latest = next;

    return latest.call(this, self);
  });
}

function provides(ctx: Context, value: Model) {
  while (ctx = ctx.parent!) {
    const entries = ctx.provide.get(value.constructor as Model.Extends);
    if (entries) for (const [state] of entries) if (state === value) return true;
  }
}

/**
 * Pending Models constructed after this one - in a parent, the products of
 * its own initializers, until the last one it kept.
 */
function trailing(state: Model) {
  const rest: Model[] = [];
  let seen = false;

  for (const item of PENDING)
    if (!seen) seen = item === state;
    else if (item instanceof Model) rest.push(item);

  return rest;
}

/**
 * Report Models adopted by a parent - those already held, then each one
 * claimed later. Returns a callback to stop watching.
 */
function children(state: Model, callback: (child: Model) => void) {
  const data = store(state);
  const keys = ADOPT.get(state);

  if (keys)
    for (const key of keys.keys()) {
      const value = data[key as string];
      if (value instanceof Model) callback(value);
    }

  return subscribe(CHILDREN, state, callback);
}

function owner(state: Model, required?: boolean) {
  const found = PARENT.get(state);

  if (found || required === false) return found || undefined;

  throw new Error(`${state} has no owner.`);
}

/**
 * Report Models owned by this one - those active now, then each one as it
 * activates. A function returned by `callback` runs when that Model is destroyed.
 */
function owned(state: Model, callback: (child: Model) => void | (() => void)) {
  function each(child: Model) {
    const done = callback(child);
    if (typeof done == 'function') listener(child, () => void done(), null);
  }

  OWNS.get(state)?.forEach(each);

  const remove = subscribe(OWNED, state, each);

  return () => void remove();
}

/** Add an item to the set kept for a key, creating it if needed. Returns a callback to remove it. */
function subscribe<K extends object, T>(map: WeakMap<K, Set<T>>, key: K, item: T) {
  let set = map.get(key);

  if (!set) map.set(key, (set = new Set()));

  set.add(item);

  return () => set!.delete(item);
}

function plain(value: unknown): value is Model.Assign<Model> {
  if (!value || typeof value != 'object') return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

function assign(state: Model, data: Model.Assign<Model>, silent?: boolean) {
  if (!silent && observer(state) !== null) event(state);

  const methods = METHODS.get(state.constructor)!;
  const getters = GETTERS.get(state.constructor);

  for (const key in data) {
    const bind = methods.get(key);

    if (key === 'is' || key === 'then') continue;
    else if (bind) bind.call(state, data[key]);
    else if (getters?.has(key)) continue;
    else if (key in state) {
      const desc: PropertyDescriptor = Object.getOwnPropertyDescriptor(state, key) || {};
      const set = desc.set as (value: any, silent?: boolean) => void;

      if (set) {
        set.call(state, data[key], silent);
      } else {
        Reflect.set(state, key, data[key]);
      }
    }
  }
}

/**
 * Pass an error along `catch` handlers - most-derived class first, last registered
 * first, one on several classes once at the outermost - until one returns nothing. Passed off
 * the end, a destroyed write outputs nothing, `unused` warns, anything else escapes uncaught;
 * so does a handler's throw.
 */
function report(kind: Parameters<NonNullable<Model.On['catch']>>[1], owner: object | undefined, error: unknown, key?: string) {
  const state = owner instanceof Model ? owner : owner && PARENT.get(owner);

  if (!state) return REPORT.error(error);

  try {
    for (const handler of [...stages(state.constructor as Model.Extends, 'catch')].reverse())
      if ((error = handler.call(state, error, kind, key)) === undefined) return;

    if (kind == 'unused') console.warn(error);
    else if (kind != 'dead') REPORT.error(error);
  } catch (err) {
    REPORT.error(err);
  }
}

REPORT.as = report;
HELD.adopt = adopt;

/**
 * Hand a value stored by an owning writer to that property's adopter,
 * creating one the first time a Model is stored there. A property which has
 * held a Model keeps its adopter, so a later non-Model value releases the
 * previous child.
 */
function adopt(state: Model, key: unknown, value: unknown) {
  let keys = ADOPT.get(state);

  if (!keys) {
    if (!(value instanceof Model)) return;
    ADOPT.set(state, (keys = new Map()));
  }

  let claim = keys.get(key);

  if (claim) return claim(value);

  if (!(value instanceof Model)) return;

  let cleanup: (() => void) | undefined;
  const ctx = Context.get(state);

  function reset() {
    if (cleanup) cleanup();
    cleanup = undefined;
  }

  listener(state, reset, null);

  claim = (value: unknown) => {
    reset();

    if (!(value instanceof Model)) return;

    if (parent(value, state)) {
      const remove = join(state, value);
      cleanup = () => {
        cancel();
        remove();
        event(value, null);
      };
      const cancel = listener(state, cleanup, null);
    } else if (!provides(ctx, value)) {
      cleanup = join(state, value);
    }

    event(value);

    CHILDREN.get(state)?.forEach((cb) => cb(value));
  };

  keys.set(key, claim);
  claim(value);
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid() {
  return (0.278 + Math.random() * 0.722)
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

/**
 * Original function behind a bound Model method - any other function returns as given.
 *
 * Unwraps an instance's bound method, a prototype method's binding getter, and a `_` method's wrapper.
 *
 * @example
 * const save = unbind(this.save);
 * save.call(other);
 */
function unbind<T extends Function>(fn: T): T;
/** Original function behind a bound Model method - `undefined` and other functions return as given. */
function unbind<T extends Function>(fn?: T): T | undefined;
function unbind(fn?: Function) {
  return UNBIND.get(fn) || fn;
}

/**
 * Read or claim a parent for a given child. In read mode (one argument) returns
 * the current parent, or `undefined` if never assigned. In write mode assigns
 * only if unclaimed and returns whether the assignment applied - `true` means
 * this call freshly claimed it, `false` means it was already parented.
 */
function parent(child: object): Model | null | undefined;
function parent(child: object, value: Model | null): boolean;
function parent(child: object, value?: Model | null) {
  if (arguments.length < 2) return PARENT.get(child as Model);
  if (PARENT.has(child as Model)) return false;
  PARENT.set(child as Model, value ?? null);
  return true;
}

export type { Got, Handler, Keyed };
export { adopt, event, plain, unbind, Model, observed, parent, children, owned, trailing, PENDING, uid, getter, classify, METHODS, GETTERS, SETUP, UNBIND, LATEST };
