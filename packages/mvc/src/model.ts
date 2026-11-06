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
  /** Any type of Model, using own class constructor as its identifier. */
  type Extends<T extends Model = Model> = (abstract new (...args: any[]) => T) &
    typeof Model;

  /** A Model constructor which may be instanciated. */
  type Type<T extends Model = Model> = (new (...args: Model.Args<T>) => T) &
    Omit<typeof Model, never>;

  /** Model constructor arguments - the first `Context` given becomes the home, unless already placed. */
  type Args<T extends Model = any> = (Args<T> | Init<T> | Overlay<T> | Context | void)[];

  /**
   * Model constructor callback - runs during activation, in argument order,
   * before the `new()` lifecycle hook (so it may configure state `new()`
   * will observe). Returned function will run when state is destroyed.
   */
  type Init<T extends Model = Model> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Overlay<T> | void;

  /** Lifecycle handlers for `Model.on`, keyed by when they run. */
  interface On<T extends Model = Model> {
    /**
     * Per-class setup, run once when the class is first bootstrapped - before
     * its members are classified and bound. Receives the class, so a handler
     * may inspect or reshape the prototype first. A handler registered on a
     * base class runs for each subclass too.
     */
    type?(type: Model.Extends<T>): void;

    /**
     * Per-instance, once constructed - before own values are observed and
     * before constructor args and `new()`. May return a cleanup, constructor
     * args, or an assign overlay.
     */
    setup?(this: T, self: T): void | (() => void) | Promise<void> | Args<T> | Overlay<T>;

    /**
     * Per-instance, once ready - after own values are observed, constructor
     * args applied, `new()` has run and any promise those returned resolved.
     * May return a cleanup function.
     */
    ready?(this: T, self: T): void | (() => void);

    /**
     * Runs each time a method is bound to an instance - first access,
     * reassignment, and the rebind after a hot patch - with the key, the bound
     * function and the instance. Not run for unbound `_` methods. Tooling and
     * development use.
     */
    method?(this: T, key: string, fn: Function, self: T): void;

    /**
     * Receives what an effect, refreshing getter or async initializer of this Model
     * or a subclass threw, a destroyed write, or an instance never activated - with
     * its `kind` (`effect`, `getter`, `setup`, `dead`, `unused`) and `key` where
     * one applies. Most-derived class first, last registered first, each once. Return the error
     * (or another) to pass it on; return nothing to handle it; throw to let it escape.
     * Passed off the end, a destroyed write outputs nothing, `unused` warns,
     * anything else escapes uncaught.
     */
    catch?(this: T, error: unknown, kind: 'effect' | 'getter' | 'setup' | 'dead' | 'unused', key?: string): unknown;
  }

  /** Object overlay to override values and methods on a state. */
  type Assign<T> = Record<string, unknown> & {
    [K in Property<T>]?: T[K];
  } & ThisType<T>;

  /** Subset of `keyof T` not defined by base Model. **/
  type Property<T> = Exclude<keyof T, keyof Model>;

  /** Managed subset of Property<T> - excludes unmanaged `_` keys. **/
  type Field<T> = Exclude<Property<T>, `_${string}` | 'then'>;

  /** Any valid key for state, including but not limited to Field<T>. */
  type Event<T = Model> = Field<T> | number | symbol | (string & {});

  /** Any event signal dispatched to listeners, including lifecycle meta events. */
  type Signal<T = Model> = Event<T> | true | false | null;

  /** Export/Import compatible value for a given property in a Model. */
  type Export<R> = R extends Model
    ? Values<R>
    : R extends { get(): infer T }
    ? T
    : R;

  /**
   * Values from current state of given state.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.Object.
   */
  type Values<T> = { [P in Field<T>]: Export<T[P]> };

  /** Object comperable to data found in T. */
  type Partial<T> = { [P in Field<T>]?: Export<T[P]> };

  /** Value for a property applied by a state. */
  type Value<T extends Model, K extends Model.Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => T | void;

  /** Descriptor config for a managed property. */
  type Apply<T = any> = Config<T, Model>;

  /** Descriptor config for set() overload - enforces type when key is a known field. */
  type Define<T, K> = K extends Field<T> ? Apply<T[K] | Export<T[K]>> : Apply;

  type OnEvent<T extends Model> = (
    this: T,
    key: Signal<T>,
    source: T
  ) => void | (() => void) | null;

  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  };

  /**
   * A callback function which is subscribed to parent and updates when accessed properties change.
   *
   * @param current - Current state of this state. This is a proxy which detects properties which
   * where accessed, and thus depended upon to stay current.
   *
   * @param update - Set of properties which have changed, and events fired, since last update.
   *
   * @returns A callback function which will be called when this effect is stale.
   */
  type Effect<T, R = EffectCallback | Promise<void> | null | void> = (
    this: T,
    current: T,
    update: readonly Model.Event<T>[] | undefined
  ) => R;

  /**
   * Returned by `get(effect)`. Call to stop the effect. Await to stop it once it
   * has run clean and receive that run's value - a sync run's output, or what its
   * promise resolved to.
   */
  type Release<R = void> = (() => void) & PromiseLike<R>;

  /**
   * A callback function returned by effect. Will be called when effect is stale.
   *
   * @param update - `true` if update is pending, `false` effect has been cancelled, `null` if state is destroyed.
   */
  type EffectCallback = (update: boolean | null) => void;

  /**
   * A list of keys updated, or events fired, since last update.
   * This may be awaited to get full list (same array) when update is settled.
   */
  type Updated<T extends Model> = readonly Event<T>[] &
    PromiseLike<readonly Event<T>[]>;
}

abstract class Model {

  /**
   * Loopback to instance of this state. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  declare is: this;

  constructor(...args: Model.Args) {
    define(this, 'is', { value: this });
    init(this, args, this.new);
  }

  /**
   * Optional lifecycle hook called during Model initialization.
   * Can return a cleanup function to run when state is destroyed.
   *
   * It is recommended you protect this method.
   */
  protected new?(): void | (() => void) | Promise<void>;

  /**
   * Pull current values from state. Flattens all states and exotic values recursively.
   *
   * @returns Object with all values from this state.
   **/
  get(): Model.Values<this>;

  /**
   * Run a function to run automatically when accessed values change.
   *
   * @param effect Function to run, and whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent state is destroyed. A returned promise
   *               defers re-runs until it settles; its resolved value is treated the same way.
   * @returns Function to cancel listener - awaited, cancels and yields the effect's value.
   */
  get(effect: Model.Effect<this>): Model.Release;

  /**
   * Run a function to run automatically when accessed values change, which
   * produces a value - sync or async. Await the returned function to cancel the
   * effect once a run completes and receive what it returned.
   */
  get<R>(effect: Model.Effect<this, Promise<R>>): Model.Release<R>;

  /**
   * Get value of a property. Will fetch underlying value from exotic values like ref.Object.
   *
   * Any value which implements `get()` (with no arguments) will be treated as such.
   *
   * @param key - Property to get value of.
   * @param required - If true, will throw an error if property is not available.
   * @returns Value of property.
   */
  get<T extends Model.Event<this>>(
    key: T,
    required?: boolean
  ): Model.Value<this, T>;

  /**
   * Check if state is destroyed.
   *
   * @param status - `null` for destroy.
   */
  get(status: null): boolean;

  /**
   * Callback when state is destroyed.
   *
   * @param status - `null` for destroy.
   * @param callback - Function to call when state is destroyed.
   * @returns Function to cancel listener.
   */
  get(status: null, callback: () => void): () => void;

  /** Fetch Model of type from context. Throws if not found. */
  get<T extends Model>(type: Model.Type<T>, required?: true): T;

  /** Fetch a Model from context. Undefined if not found. */
  get<T extends Model>(type: Model.Type<T>, required: boolean): T | undefined;

  /**
   * Subscribe to Model becoming available in context.
   *
   * Will search both up and downstream by default.
   * Normally you can ignore this because Model you expect is rarely both.
   *
   * Specify downstream if you only want to watch for Model in children, which can be useful if you expect multiple of the same Model in different branches of the tree.
   *
   * @param type - Type of Model to watch for.
   * @param callback - Function to call when Model is found. Will be called immediately if Model is already available.
   * @param downstream - If true, will only watch for Model in children, if false will only for parents.
   * @returns Function to cancel listener.
   */
  get<T extends Model>(
    type: Model.Type<T>,
    callback: Context.Expect<T>,
    downstream?: boolean
  ): () => void;

  // Owner overloads take `Model` itself only - a subclass would otherwise match
  // them in TypeScript's subtype pass, before the `Model.Type<T>` overloads.

  /** Owner of this Model. Throws if it has none. */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    required?: true
  ): Model;

  /** Owner of this Model. Undefined if it has none. */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    required: boolean
  ): Model | undefined;

  /**
   * Run a callback for each Model this one owns - those owned now, then each
   * one as it activates. Callback may return a function, called when that Model
   * is destroyed.
   *
   * @returns Function to stop watching.
   */
  get<T extends typeof Model>(
    type: T & (typeof Model extends T ? unknown : never),
    callback: (child: Model) => void | (() => void),
    downstream: true
  ): () => void;

  /**
   * Fetch through `Type.get(...args)` with this instance as origin - its
   * context, and its subscription when this is a tracking proxy.
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
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values, `undefined` if there no update is pending.
   **/
  set(): Model.Updated<this>;

  /**
   * Merge argument with current state, updating one or more properties at once.
   * Properties which are not managed by this state will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If true, listeners will not be notified. If state is destroyed, stores the update without reporting it.
   * @returns Array of keys updated, syncronously contains keys updated immediately and may be resolved (to itself) when all updates are settled.
   */
  set(assign?: Model.Assign<this>, silent?: boolean): Model.Updated<this>;

  /**
   * Call a function when update occurs.
   *
   * Given function is called for every assignment (which changes value) or explicit `set`.
   *
   * To run logic on final value only, callback may return a function. The same
   * function for one or more events will be called only once when update is settled.
   *
   * Return `null` from callback to stop listening.
   *
   * @param callback - Function to call when update occurs.
   * @returns Function to remove listener. Will return `true` if removed, `false` if inactive already.
   */
  set(callback: Model.OnEvent<this>): () => boolean;

  /**
   * Push an update. This will not change the value of associated property.
   *
   * Useful where a property value internally has changed, but the object is the same.
   * For example: An array has pushed a new value, or a nested property is updated.
   *
   * You can also use this to dispatch arbitrary events.
   * Symbols are recommended as non-property events, however you can use any string.
   * If doing so, be sure to avoid collisions using property names. An easy way to do this is
   * to prefix an event with "!" and/or use dash-case. e.g. `set("!event")` or `set("my-event")`.
   *
   * @param key - Property or event to dispatch.
   * @returns Promise resolves an array of keys updated.
   */
  set(key: Model.Event<this>): Model.Updated<this>;

  /**
   * Declare an end to updates. This event is final - later writes are stored but never dispatched.
   * This event can be watched for as well, to run cleanup logic and internally will remove all listeners.
   *
   * @param status - `null` to end updates.
   */
  set(status: null): void;

  /**
   * Register a callback for a specific property or event.
   *
   * Callback receives the key, current value, and source instance.
   *
   * @param event - Property or event to watch. If `null`, will callback on destroy.
   * @param callback - Function to call when event occurs.
   * @returns Function to remove listener.
   */
  set<K extends Model.Event<this>>(
    event: K | null,
    callback: Model.OnEvent<this>
  ): () => boolean;

  /**
   * Define or update a managed property using a descriptor config.
   * If the property already is managed, config will only accept value.
   * If the property does not exist, it will be created and made reactive.
   *
   * @param key - Property to define or update.
   * @param config - Descriptor config with value, get, set, enumerable, and/or destroy.
   * @returns Promise resolves an array of keys updated.
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

  /**
   * Iterate over managed properties in this instance of Model.
   * Yeilds the key and current value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return entries(this.is)[Symbol.iterator]();
  }

  /**
   * Create and activate a new instance of this state.
   *
   * **Important** - Unlike `new this(...)` - this method also activates state.
   *
   * @param args - arguments sent to constructor; a `Context` among them becomes its home
   */
  static new<T extends Model>(this: Model.Type<T>, ...args: Model.Args<T>): T {
    const instance = new this(...args);
    event(instance);
    return instance;
  }

  /**
   * Fetch instance of this class from context. Throws if not found.
   *
   * Override with a single signature to accept other arguments - delegate
   * base forms to `super.get(arg)`, and resolve others by calling
   * `Context.get(this, compute)` once, synchronously, so host context and
   * tracking still apply.
   */
  static get<T extends Model>(this: Model.Extends<T>): T;

  /** Fetch instance of this class from context. Undefined if not found. */
  static get<T extends Model>(this: Model.Extends<T>, required: false): T | undefined;

  static get(this: Model.Extends, required?: false): any {
    return Context.get(this, (context, from) => {
      const found = context.get(this, required !== false, undefined, from);

      if (found || required === false) return found || undefined;

      throw new Error(`Could not find ${this} in context.`);
    });
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Extends>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  /**
   * Register a lifecycle handler for this Model and its subclasses.
   *
   * Hooks by cadence - `type` (per-class, at bootstrap), `setup` (per-instance,
   * before values are observed), `ready` (per-instance, after `new()`), and
   * `method` (per method binding). A function alone is a `setup` handler. A
   * function returned from `setup` or `ready` runs when the instance is destroyed.
   *
   * @returns Function to remove the handler.
   */
  static on<T extends Model>(
    this: Model.Extends<T>,
    setup: NonNullable<Model.On<T>['setup']>
  ): () => boolean;

  static on<T extends Model>(
    this: Model.Extends<T>,
    handler: Model.On<T>
  ): () => boolean;

  static on<T extends Model>(
    this: Model.Extends<T>,
    handler: Model.On<T> | NonNullable<Model.On<T>['setup']>
  ) {
    if (typeof handler == 'function') handler = { setup: handler };

    let setup = SETUP.get(this);

    if (!setup) SETUP.set(this, (setup = new Set()));

    setup.add(handler);

    return () => setup.delete(handler);
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

  listener(state, (key) => {
    const rest = trailing(state);

    PENDING.delete(state);

    if (key === null) return null;

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
  compute.call(this, function (this: Model, self: Model) {
    let latest = get;

    for (let next; (next = LATEST.get(latest)); ) latest = next;

    return latest.call(this, self);
  }, key);
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

  let set = CHILDREN.get(state);

  if (!set) CHILDREN.set(state, (set = new Set()));

  set.add(callback);

  return () => set!.delete(callback);
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

  let set = OWNED.get(state);

  if (!set) OWNED.set(state, (set = new Set()));

  set.add(each);

  return () => void set!.delete(each);
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

function unbind<T extends Function>(fn: T): T;
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
