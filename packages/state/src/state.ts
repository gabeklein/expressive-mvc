import { Context } from './context';
import {
  event,
  listener,
  Observable,
  observer,
  pending,
  touch,
  watch
} from './observable';

const define = Object.defineProperty;

/** Register for all active states via string identifiers (usually unique). */
const ID = new WeakMap<State, string>();

/** Internal state assigned to states. */
const STORE = new WeakMap<State, Record<string | number | symbol, unknown>>();

/** External lifecycle listeners for any given State class. */
const SETUP = new WeakMap<State.Extends, Set<State.Init<any>>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<State, State | null>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** List of reactive getters defined by a given type. */
const GETTERS = new WeakMap<Function, Map<string, () => unknown>>();

/** Stale flags for compute closures awaiting refresh on next access. */
const STALE = new WeakSet<() => void>();

declare namespace State {
  /** Any type of State, using own class constructor as its identifier. */
  type Extends<T extends State = State> = (abstract new (...args: any[]) => T) &
    typeof State;

  /** A State constructor which may be instanciated. */
  type Type<T extends State = State> = (new (...args: State.Args<T>) => T) &
    Omit<typeof State, never>;

  /** State constructor arguments */
  type Args<T extends State = any> = (Args<T> | Init<T> | Assign<T> | void)[];

  /**
   * State constructor callback - is called when State finishes intializing.
   * Returned function will run when state is destroyed.
   */
  type Init<T extends State = State> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Assign<T> | void;

  /** Object overlay to override values and methods on a state. */
  type Assign<T> = Record<string, unknown> & {
    [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
    ? (this: T, ...args: A) => R
    : T[K];
  };

  /** Subset of `keyof T` which are not methods or defined by base State U. **/
  type Field<T> = Exclude<keyof T, keyof State>;

  /** Any valid key for state, including but not limited to Field<T>. */
  type Event<T = State> = Field<T> | number | symbol | (string & {});

  /** Any event signal dispatched to listeners, including lifecycle meta events. */
  type Signal<T = State> = Event<T> | true | false | null;

  /** Export/Import compatible value for a given property in a State. */
  type Export<R> = R extends State
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
  type Value<T extends State, K extends State.Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => T | void;

  /** Descriptor config for a managed property. */
  type Apply<T = any> = {
    value?: T;
    get?: ((source: State) => T) | boolean;
    set?: Setter<T> | boolean;
    enumerable?: boolean;
    // destroy?: () => void;
  };

  /** Descriptor config for set() overload - enforces type when key is a known field. */
  type Define<T, K> = K extends Field<T> ? Apply<T[K] | Export<T[K]>> : Apply;

  type OnEvent<T extends State> = (
    this: T,
    key: Signal<T>,
    source: T
  ) => void | (() => void) | null;

  type OnUpdate<T extends State, K extends State.Event<T>> = (
    this: T,
    key: K,
    thisArg: K
  ) => void;

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
  type Effect<T> = (
    this: T,
    current: T,
    update: readonly State.Event<T>[] | undefined
  ) => EffectCallback | Promise<void> | null | void;

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
  type Updated<T extends State> = readonly Event<T>[] &
    PromiseLike<readonly Event<T>[]>;
}

abstract class State {
  /**
   * Loopback to instance of this state. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  declare is: this;

  constructor(...args: State.Args) {
    define(this, 'is', { value: this });
    init(this, args, this.new);
  }

  /**
   * Optional lifecycle hook called during State initialization.
   * Can return a cleanup function to run when state is destroyed.
   *
   * It is recommended you protect this method.
   */
  protected new?(): void | (() => void);

  /**
   * Pull current values from state. Flattens all states and exotic values recursively.
   *
   * @returns Object with all values from this state.
   **/
  get(): State.Values<this>;

  /**
   * Run a function to run automatically when accessed values change.
   *
   * @param effect Function to run, and whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent state is destroyed.
   * @returns Function to cancel listener.
   */
  get(effect: State.Effect<this>): () => void;

  /**
   * Get value of a property. Will fetch underlying value from exotic values like ref.Object.
   *
   * Any value which implements `get()` (with no arguments) will be treated as such.
   *
   * @param key - Property to get value of.
   * @param required - If true, will throw an error if property is not available.
   * @returns Value of property.
   */
  get<T extends State.Event<this>>(
    key: T,
    required?: boolean
  ): State.Value<this, T>;

  /**
   * Run a function when a property is updated and has settled.
   *
   * Not to be confused with `set(event, callback)`, which runs on every update,
   * even if value is the same, and before updates are settled.
   *
   * @param key - Property to watch for updates.
   * @param callback - Function to call when property is updated.
   * @returns Function to cancel listener.
   */
  get<T extends State.Event<this>>(
    key: T,
    callback: State.OnUpdate<this, T>
  ): () => void;

  /**
   * Check if state is destroyed.
   *
   * @param status - `null` to check if state is destroyed.
   * @returns `true` if state is destroyed, `false` otherwise.
   */
  get(status: null): boolean;

  /**
   * Callback when state is to be destroyed.
   *
   * @param callback - Function to call when state is destroyed.
   * @returns Function to cancel listener.
   */
  get(status: null, callback: () => void): () => void;

  /** Fetch State of type from context. Throws if not found. */
  get<T extends State>(type: State.Type<T>, required?: true): T;

  /** Fetch a State from context. Undefined if not found. */
  get<T extends State>(type: State.Type<T>, required: boolean): T | undefined;

  /**
   * Subscribe to State becoming available in context.
   *
   * Will search both up and downstream by default.
   * Normally you can ignore this because State you expect is rarely both.
   *
   * Specify downstream if you only want to watch for State in children, which can be useful if you expect multiple of the same State in different branches of the tree.
   *
   * @param type - Type of State to watch for.
   * @param callback - Function to call when State is found. Will be called immediately if State is already available.
   * @param downstream - If true, will only watch for State in children, if false will only for parents.
   * @returns Function to cancel listener.
   */
  get<T extends State>(
    type: State.Type<T>,
    callback: Context.Expect<T>,
    downstream?: boolean
  ): () => void;

  get(
    arg1?: State.Effect<this> | State.Type | string | null,
    arg2?: boolean | Context.Expect | State.OnUpdate<this, any>,
    arg3?: boolean
  ) {
    const self = this.is;

    if (arg1 === undefined) return values(self);
    if (State.is(arg1)) return Context.get(self).get(arg1, arg2, arg3, self);
    if (typeof arg1 == 'function') return watch(self, unbind(arg1));
    if (typeof arg2 == 'function') return callback(self, arg2, arg1);
    if (arg1 === null) return observer(self) === null;
    return access(self, arg1, arg2);
  }

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values, `undefined` if there no update is pending.
   **/
  set(): State.Updated<this>;

  /**
   * Merge argument with current state, updating one or more properties at once.
   * Properties which are not managed by this state will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If true, listeners will not be notified. If state is destroyed, will squash update without throwing.
   * @returns Array of keys updated, syncronously contains keys updated immediately and may be resolved (to itself) when all updates are settled.
   */
  set(assign?: State.Assign<this>, silent?: boolean): State.Updated<this>;

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
  set(callback: State.OnEvent<this>): () => boolean;

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
  set(key: State.Event<this>): State.Updated<this>;

  /**
   * Declare an end to updates. This event is final and will freeze state.
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
  set<K extends State.Event<this>>(
    event: K | null,
    callback: State.OnEvent<this>
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
  set<K extends State.Event<this>>(
    key: K,
    config: State.Define<this, K>
  ): State.Updated<this>;

  set(
    arg1?: State.OnEvent<this> | State.Assign<this> | State.Event<this> | null,
    arg2?: unknown
  ) {
    const self = this.is;

    if (typeof arg1 == 'function')
      return listener(self, (key) => {
        if (
          typeof key == 'string' ||
          typeof key == 'number' ||
          typeof key == 'symbol'
        )
          return arg1.call(self, key, self);
      });

    if (typeof arg2 == 'function')
      return callback(self, arg2, arg1 as State.Signal);

    if (arg1 && typeof arg1 == 'object') assign(self, arg1, arg2 === true);
    else if (arg2) apply(self, arg1 as string, arg2);
    else event(self, arg1);

    return pending(self) as State.Updated<this>;
  }

  /**
   * Iterate over managed properties in this instance of State.
   * Yeilds the key and current value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STORE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Create and activate a new instance of this state.
   *
   * **Important** - Unlike `new this(...)` - this method also activates state.
   *
   * @param args - arguments sent to constructor
   */
  static new<T extends State>(this: State.Type<T>, ...args: State.Args<T>): T {
    const instance = new this(...args);
    event(instance);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends State.Extends>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  /**
   * Register a callback to run when any instance of this State is created.
   * If callback returns a function, it will be called when the instance is destroyed.
   */
  static on<T extends State>(this: State.Extends<T>, init: State.Init<T>) {
    let setup = SETUP.get(this);

    if (!setup) SETUP.set(this, (setup = new Set()));

    setup.add(init);

    return () => setup.delete(init);
  }
}

define(State.prototype, 'toString', {
  value() {
    return ID.get(this.is);
  }
});

define(State, 'toString', {
  value() {
    return this.name;
  }
});

/** Register a user OnEvent/OnUpdate callback, preserving `this` and `source`. */
function callback<T extends State>(
  self: T,
  cb: Function,
  select?: Observable.Signal | Set<Observable.Signal>
) {
  return listener(self, (key) => cb.call(self, key, self), select);
}

/**
 * Apply state arguemnts, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(state: State, ...args: State.Args) {
  const T = state.constructor as State.Extends;

  if (T === State) throw new Error('Cannot create base State.');

  const prepare = bootstrap(T);

  ID.set(state, `${T}-${uid()}`);
  STORE.set(state, {});

  function observe() {
    for (const key in state) {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;
      if ('value' in desc) apply(state, key, desc, true);
    }
  }

  function register() {
    if (Context.get(state) === Context.root) return Context.root.add(state);
  }

  listener(state, () => {
    parent(state, null);

    const queue = [...prepare, observe, ...args, register];

    for (let i = 0; i < queue.length; i++) {
      const arg = queue[i];
      const out = typeof arg == 'function' ? arg.call(state, state) : arg;

      if (out instanceof Promise)
        out.catch((err) => {
          console.error(`Async error in constructor for ${state}:`);
          console.error(err);
        });
      else if (Array.isArray(out)) queue.splice(i + 1, 0, ...out);
      else if (typeof out == 'function') listener(state, out, null);
      else if (typeof out == 'object') assign(state, out, true);
    }

    return null;
  });
}

/**
 * Apply instructions and inherited event listeners. Ensure class metadata is ready.
 *
 * @param T - State class to bootstrap.
 * @return Array of init functions to run on instance, in order of class hierarchy.
 */
function bootstrap(T: State.Extends) {
  const chain = [] as State.Extends[];
  const setup = [] as State.Init[];
  let keys = new Map<string, (value: any) => void>();
  let getters = new Map<string, () => unknown>();

  do {
    chain.unshift(T);
    T = Object.getPrototypeOf(T);
  } while (T.name);

  for (const type of chain) {
    setup.push(...(SETUP.get(type) || []));

    if (type === State) continue;

    if (METHODS.has(type)) {
      keys = METHODS.get(type)!;
      getters = GETTERS.get(type)!;
      continue;
    }

    METHODS.set(type, (keys = new Map(keys)));
    GETTERS.set(type, (getters = new Map(getters)));

    for (const [key, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(type.prototype)
    )) {
      if (key == 'constructor') continue;

      if (typeof desc.get == 'function') {
        if (desc.configurable && typeof desc.set != 'function')
          getters.set(key, desc.get);

        continue;
      }

      const { value } = desc;

      if (typeof value !== 'function') continue;

      function bind(this: State, original?: Function) {
        const { is } = this;

        if (is.hasOwnProperty(key) && !original) return value as Function;

        const fn = original || value;
        const bound = fn.bind(is);

        METHOD.set(bound, fn);
        define(is, key, { value: bound, writable: true, configurable: true });

        return bound;
      }

      keys.set(key, bind);
      define(type.prototype, key, { get: bind, set: bind });
    }
  }

  if (getters.size)
    setup.push((self) => getters.forEach(compute, self));

  return new Set(setup);
}

/**
 * Install a reactive computed property on a state instance, derived from a prototype getter.
 *
 * The getter is invoked with the tracking proxy as `this`; reads of managed properties
 * through it create subscriptions. Result is cached and emits a keyed event when stale.
 */
function compute(this: State, getter: () => unknown, key: string) {
  const store = STORE.get(this)!;
  let reset: (() => void) | undefined;
  let isAsync: boolean;
  let proxy: any;

  const connect = () => {
    reset = watch(
      this,
      (current) => {
        proxy = current;

        if (!(key in store) || STALE.delete(run)) run(!reset);

        return (didUpdate) => {
          if (didUpdate) {
            STALE.add(run);
            event(this, key, true);
          }
        };
      },
      false
    );
  };

  const run = (initial?: boolean) => {
    let next: unknown;

    try {
      next = getter.call(proxy);
    } catch (err) {
      console.warn(
        `An exception was thrown while ${initial ? 'initializing' : 'refreshing'
        } ${this}.${key}.`
      );

      if (initial) throw err;

      console.error(err);
    }

    update(this, key, next, !isAsync);
  };

  apply(
    this,
    key,
    {
      enumerable: true,
      set: false,
      get: () => {
        if (!proxy) {
          connect();
          isAsync = true;
        }

        if (STALE.delete(run)) run();

        return access(this, key, !proxy);
      }
    },
    true
  );
}

/**
 * Define or update a managed property using a descriptor config.
 * If the property already is managed, config will only accept value.
 * If the property does not exist, it will be created and made reactive.
 *
 * @param state - State to apply property to.
 * @param key - Property to define or update.
 * @param config - Descriptor config with value, get, set, enumerable, and/or destroy.
 * @param silent - If an update does occur, listeners will not be refreshed automatically.
 */
function apply(
  state: State,
  key: string,
  config: State.Apply,
  silent?: boolean
) {
  const desc = Object.getOwnPropertyDescriptor(state, key);

  if (desc && 'get' in desc) {
    if (Object.keys(config).some((k) => k != 'value'))
      throw new Error(`Property ${key} on ${state} is already defined.`);
    if ('value' in config) update(state, key, config.value, silent);
    return;
  }

  const adopt = config.value instanceof State && child(state);

  function set(value: unknown, silent?: boolean) {
    if (!update(state, key, value, silent)) return;
    if (adopt) adopt(value);
  }

  define(state, key, {
    configurable: true,
    enumerable: config.enumerable !== false,
    get(this: State) {
      const value =
        typeof config.get == 'function'
          ? config.get(this)
          : access(state, key, config.get);

      return touch(this, key, value);
    },
    set(next: any, silent?: boolean) {
      if (config.set === false)
        throw new Error(`${state}.${String(key)} is read-only.`);

      if (typeof config.set == 'function')
        try {
          const output = config.set(next, STORE.get(state)![key]);
          if (output !== undefined) next = output;
        } catch (err: unknown) {
          if (err === false) return;
          if (err === true) {
            set(next, true);
            return;
          }
          throw err;
        }

      set(next, silent);
    }
  });

  if ('value' in config) set(config.value, silent);
}

function child(state: State) {
  let cleanup: (() => void) | undefined;
  const ctx = Context.get(state);

  function reset() {
    if (cleanup) cleanup();
    cleanup = undefined;
  }

  listener(state, reset, null);

  return (value: unknown) => {
    reset();

    if (!(value instanceof State)) return;

    const remove = ctx.add(value);

    if (parent(value) === undefined) {
      parent(value, state);
      cleanup = () => {
        cancel();
        remove();
        event(value, null);
      };
      const cancel = listener(state, cleanup, null);
    } else {
      cleanup = remove;
    }

    event(value);
  };
}

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child states. */
let EXPORT: Map<any, any> | undefined;

function values<T extends State>(state: T): State.Values<T> {
  const values = {} as any;
  let notRecursive;

  if (!EXPORT) {
    notRecursive = true;
    EXPORT = new Map([[state, values]]);
  }

  for (let [key, value] of state) {
    if (EXPORT.has(value)) value = EXPORT.get(value);
    else if (
      value &&
      typeof value == 'object' &&
      'get' in value &&
      typeof value.get === 'function'
    )
      EXPORT.set(value, (value = value.get()));

    values[key] = value;
  }

  if (notRecursive) EXPORT = undefined;

  return Object.freeze(values);
}

function access(state: State, property: string, required?: boolean) {
  const store = STORE.get(state)!;

  if (property in store || required === false) {
    const value = store[property];

    if (value !== undefined || !required) return value;
  }

  if (METHODS.get(state.constructor)!.has(property))
    return unbind((state as any)[property]);

  const error = new Error(`${state}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    listener(state, (key) => {
      if (key === property) {
        resolve(store[key]);
        return null;
      }

      if (key === null) {
        reject(new Error(`${state} is destroyed.`));
      }
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: 'Suspense',
    message: error.message,
    stack: error.stack
  });
}

function assign(state: State, data: State.Assign<State>, silent?: boolean) {
  if (!silent) event(state);

  const methods = METHODS.get(state.constructor)!;

  for (const key in data) {
    const bind = methods.get(key);

    if (bind) bind.call(state, data[key]);
    else if (key in state && key !== 'is') {
      const desc = Object.getOwnPropertyDescriptor(state, key)!;
      const set = desc && (desc.set as (value: any, silent?: boolean) => void);

      if (set) {
        set.call(state, data[key], silent);
      } else {
        (state as any)[key] = data[key];
      }
    }
  }
}

/**
 * Update a property on a state instance and notify listeners.
 *
 * This is used internally to update properties, but can also be used to update properties which are not managed by state, or to update values without triggering setters.
 *
 * If `silent` is true, the update will not dispatch events and will return `false` instead of throwing if state is destroyed.
 */
function update<T>(
  state: State,
  key: State.Event<T>,
  value: T,
  silent?: boolean
) {
  if (observer(state) === null) {
    if (silent) return false;
    throw new Error(
      `Tried to update ${state}.${String(key)} but state is destroyed.`
    );
  }

  const store = STORE.get(state)!;

  if (key in store && value === store[key]) return false;

  store[key] = value;

  if (!silent) event(state, key);

  return true;
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
  return METHOD.get(fn) || fn;
}

/**
 * Get or set a parent on given state. May only be assigned once; ignores new value.
 * Returns parent of child, or `undefined` if not assigned yet.
 */
function parent(child: State, value?: State | null) {
  if (arguments.length > 1 && !PARENT.has(child)) PARENT.set(child, value!);
  return PARENT.get(child);
}

export { event, unbind, State, parent, STORE, uid, access, update, apply };
