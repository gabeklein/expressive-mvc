import {
  addListener,
  watch,
  event,
  Observable,
  Notify,
  PENDING_KEYS
} from './control';

const define = Object.defineProperty;

/** Register for all active models via string identifiers (usually unique). */
const ID = new WeakMap<State, string>();

/** Internal state assigned to models. */
const STATE = new WeakMap<State, Record<string | number | symbol, unknown>>();

/** External listeners for any given State. */
const NOTIFY = new WeakMap<State.Extends, Set<Notify>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<State, State | null>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child models. */
let EXPORT: Map<any, any> | undefined;

declare namespace State {
  /**
   * State which is valid to create.
   *
   * This interface may be augmented to add dditional
   * constraints on models, such as special hooks or properties,
   * to interact with environment or helper frameworks.
   **/
  interface Valid extends State {
    'new'?(): void | (() => void);
  }

  /**
   * A State class which is valid and may be instantiated.
   */
  type New<T extends State> = State.Class<T & Valid>;

  /** Any type of State, using own class constructor as its identifier. */
  type Extends<T extends State = State> = (abstract new (...args: any[]) => T) &
    typeof State;

  /** A State constructor which is not abstract. */
  type Class<T extends State = State> = (new (...args: State.Args<T>) => T) &
    Omit<typeof State, never>;

  /** State constructor arguments */
  type Args<T extends State = any> = (
    | Args<T>
    | Init<T>
    | Assign<T>
    | string
    | void
  )[];

  /**
   * State constructor callback - is called when State finishes intializing.
   * Returned function will run when model is destroyed.
   */
  type Init<T extends State = State> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Assign<T> | void;

  /** Object overlay to override values and methods on a model. */
  type Assign<T> = Record<string, unknown> & {
    [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
      ? (this: T, ...args: A) => R
      : T[K];
  };

  /** Subset of `keyof T` which are not methods or defined by base State U. **/
  type Field<T> = Exclude<keyof T, keyof State>;

  /** Any valid key for model, including but not limited to Field<T>. */
  type Event<T> = Field<T> | number | symbol | (string & {});

  /** Export/Import compatible value for a given property in a State. */
  type Export<R> = R extends { get(): infer T } ? T : R;

  /** Value for a property managed by a model. */
  type Value<T extends State, K extends Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type OnEvent<T extends State> = (
    this: T,
    key: unknown,
    source: T
  ) => void | (() => void) | null;

  type OnUpdate<T extends State, K extends Event<T>> = (
    this: T,
    key: K,
    thisArg: K
  ) => void;

  /**
   * Values from current state of given model.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.Object.
   */
  type Values<T> = { [P in Field<T>]: Export<T[P]> };

  /** Object comperable to data found in T. */
  type Partial<T> = { [P in Field<T>]?: Export<T[P]> };

  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  };

  /**
   * A callback function which is subscribed to parent and updates when accessed properties change.
   *
   * @param current - Current state of this model. This is a proxy which detects properties which
   * where accessed, and thus depended upon to stay current.
   *
   * @param update - Set of properties which have changed, and events fired, since last update.
   *
   * @returns A callback function which will be called when this effect is stale.
   */
  type Effect<T> = (
    this: T,
    current: T,
    update: Set<Event<T>>
  ) => EffectCallback | Promise<void> | null | void;

  /**
   * A callback function returned by effect. Will be called when effect is stale.
   *
   * @param update - `true` if update is pending, `false` effect has been cancelled, `null` if model is destroyed.
   */
  type EffectCallback = (update: boolean | null) => void;
}

interface State {
  /**
   * Loopback to instance of this model. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

abstract class State implements Observable {
  constructor(...args: State.Args) {
    prepare(this);
    define(this, 'is', { value: this });
    init(this, args);
  }

  [Observable](callback: Observable.Callback, required?: boolean) {
    const watch = new Set<unknown>();
    const proxy = Object.create(this);

    addListener(this, (key) => {
      if (watch.has(key)) callback();
    });

    OBSERVER.set(proxy, (key, value) => {
      if (value === undefined && required)
        throw new Error(`${this}.${key} is required in this context.`);

      watch.add(key);

      if (value instanceof Object && Observable in value)
        return value[Observable](callback, required) || value;

      return value;
    });

    return proxy as this;
  }

  /**
   * Pull current values from state. Flattens all models and exotic values recursively.
   *
   * @returns Object with all values from this model.
   **/
  get(): State.Values<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   *
   * @param effect Function to run, and again whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent model is destroyed.
   * @returns Function to cancel listener.
   */
  get(effect: State.Effect<this>): () => void;

  /**
   * Get value of a property.
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
   * Run a function when a property is updated.
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
   * Check if model is expired.
   *
   * @param status - `null` to check if model is expired.
   * @returns `true` if model is expired, `false` otherwise.
   */
  get(status: null): boolean;

  /**
   * Callback when model is to be destroyed.
   *
   * @param callback - Function to call when model is destroyed.
   * @returns Function to cancel listener.
   */
  get(status: null, callback: () => void): () => void;

  get(
    arg1?: State.Effect<this> | string | null,
    arg2?: boolean | State.OnUpdate<this, any>
  ) {
    const self = this.is;

    if (arg1 === undefined) {
      const values = {} as any;
      let isNotRecursive;

      if (!EXPORT) {
        isNotRecursive = true;
        EXPORT = new Map([[self, values]]);
      }

      for (let [key, value] of self) {
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

      if (isNotRecursive) EXPORT = undefined;

      return Object.freeze(values);
    }

    if (typeof arg1 == 'function') {
      const effect = METHOD.get(arg1) || arg1;
      let pending = new Set<State.Event<this>>();

      return watch(self, (proxy) => {
        const cb = effect.call(proxy, proxy, pending);

        return cb === null
          ? null
          : (update) => {
              pending = PENDING_KEYS.get(self)!;
              if (typeof cb == 'function') cb(update);
            };
      });
    }

    return typeof arg2 == 'function'
      ? addListener(self, arg2, arg1)
      : arg1 === null
        ? Object.isFrozen(STATE.get(self))
        : access(self, arg1, arg2);
  }

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values, `undefined` if there no update is pending.
   **/
  set(): PromiseLike<State.Event<this>[]> | undefined;

  /**
   * Update mulitple properties at once. Merges argument with current state.
   * Properties which are not managed by this model will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If an update does occur, listeners will not be refreshed automatically.
   * @returns Promise resolving an array of keys updated, `undefined` (immediately) if a noop.
   */
  set(
    assign?: State.Assign<this>,
    silent?: boolean
  ): PromiseLike<State.Event<this>[]> | undefined;

  /**
   * Push an update. This will not change the value of associated property.
   *
   * Useful where a property value internally has changed, but the object is the same.
   * For example: An array has pushed a new value, or a nested property is updated.
   *
   * You can also use this to dispatch arbitrary events.
   * Symbols are recommended as non-property events, however you can use any string.
   * If doing so, be sure to avoid collisions with property names! An easy way to do this is
   * to prefix an event with "!" and/or use dash-case. e.g. `set("!event")` or `set("my-event")`.
   *
   * @param key - Property or event to dispatch.
   * @returns Promise resolves an array of keys updated.
   */
  set(key: State.Event<this>): PromiseLike<State.Event<this>[]>;

  /**
   * Set a value for a property. This will update the value and notify listeners.
   *
   * **Use with caution!** Key nor value are checked for validity.
   *
   * This is meant for assigning values programmatically,
   * where simple assignment is not practicable.
   *
   * For example: `(this as any)[myProperty] = value;`
   *
   * @param key - Property to set value for.
   * @param value - Value to set for property.
   * @param init - If true, model will begin to manage the property if it is not already.
   * @returns Promise resolves an array of keys updated.
   */
  set(
    key: State.Event<this>,
    value: unknown,
    init?: boolean
  ): PromiseLike<State.Event<this>[]>;

  /**
   * Call a function when update occurs.
   *
   * Given function is called for every assignment (which changes value) or explicit `set`.
   *
   * To run logic on final value only, callback may return a function. Using the same
   * function for one or more events will ensure it is called only when events are settled.
   *
   * @param callback - Function to call when update occurs.
   * @returns Function to remove listener. Will return `true` if removed, `false` if inactive already.
   *
   */
  set(callback: State.OnEvent<this>): () => boolean;

  /**
   * Call a function when a property is updated.
   * Unlike `get`, this calls synchronously and will fire as many times as the property is updated.
   *
   * @param callback - Function to call when property is updated.
   * @param event - Property to watch for updates.
   */
  set(
    callback: State.OnEvent<this>,
    event: State.Event<this> | null
  ): () => boolean;

  /**
   * Declare an end to updates. This event is final and will freeze state.
   * This event can be watched for as well, to run cleanup logic and internally will remove all listeners.
   *
   * @param status - `null` to end updates.
   */
  set(status: null): void;

  set(
    arg1?: State.OnEvent<this> | State.Assign<this> | State.Event<this> | null,
    arg2?: unknown,
    arg3?: boolean
  ) {
    const self = this.is;

    if (typeof arg1 == 'function')
      return addListener(self, (key) => {
        if (arg2 === key || (arg2 === undefined && typeof key == 'string'))
          return arg1.call(self, key, self);
      });

    if (arg1 && typeof arg1 == 'object') {
      assign(self, arg1, arg2 === true);
    } else if (!arg2) {
      event(self, arg1);
    } else if (arg3) {
      manage(self, arg1 as string | number, arg2);
    } else {
      update(self, arg1 as string | number, arg2);
    }

    const pending = PENDING_KEYS.get(this);

    if (pending)
      return <PromiseLike<State.Event<this>[]>>{
        then: (res) =>
          new Promise<any>((res) => {
            const remove = addListener(this, (key) => {
              if (key !== true) {
                remove();
                return res.bind(null, Array.from(pending));
              }
            });
          }).then(res)
      };
  }

  /**
   * Iterate over managed properties in this instance of State.
   * Yeilds the key and current value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Create and activate a new instance of this model.
   *
   * **Important** - Unlike `new this(...)` - this method also activates state.
   *
   * @param args - arguments sent to constructor
   */
  static new<T extends State>(this: State.New<T>, ...args: State.Args<T>): T {
    const instance = new this(...args, (x) => {
      const cb = x.new && x.new();
      if (cb) x.set(cb, null);
    });
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
   * Register a callback to run when any instance of this State is updated.
   */
  static on<T extends State>(
    this: State.Extends<T>,
    listener: State.OnEvent<T>
  ) {
    let notify = NOTIFY.get(this);

    if (!notify) NOTIFY.set(this, (notify = new Set()));

    notify.add(listener);

    return () => notify.delete(listener);
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

function assign(subject: State, data: State.Assign<State>, silent?: boolean) {
  const methods = METHODS.get(subject.constructor)!;

  for (const key in data) {
    const bind = methods.get(key);

    if (bind) bind.call(subject, data[key]);
    else if (key in subject && key !== 'is') {
      const desc = Object.getOwnPropertyDescriptor(subject, key)!;
      const set = desc && (desc.set as (value: any, silent?: boolean) => void);

      if (set) {
        set.call(subject, data[key], silent);
      } else {
        (subject as any)[key] = data[key];
      }
    }
  }
}

/** Apply instructions and inherited event listeners. Ensure class metadata is ready. */
function prepare(model: State) {
  let T = model.constructor as State.Extends;

  if (T === State) throw new Error('Cannot create base State.');

  const chain = [] as State.Extends[];
  let keys = new Map<string, (value: any) => void>();

  ID.set(model, `${T}-${uid()}`);

  while (T.name) {
    for (const cb of NOTIFY.get(T) || []) {
      addListener(model, cb);
    }

    if (T === State) break;
    else chain.unshift(T);

    T = Object.getPrototypeOf(T);
  }

  for (const type of chain) {
    if (METHODS.has(type)) {
      keys = METHODS.get(type)!;
      continue;
    }

    METHODS.set(type, (keys = new Map(keys)));

    for (const [key, { value }] of Object.entries(
      Object.getOwnPropertyDescriptors(type.prototype)
    )) {
      if (!value || key == 'constructor') continue;

      function bind(this: State, original?: Function) {
        const { is } = this;

        if (is.hasOwnProperty(key) && !original) return value as Function;

        const fn = original || value;
        const bound = fn.bind(is);

        METHOD.set(bound, fn);
        define(is, key, { value: bound, writable: true });

        return bound;
      }

      keys.set(key, bind);
      define(type.prototype, key, { get: bind, set: bind });
    }
  }
}

/**
 * Apply model arguemnts, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(model: State, args: State.Args) {
  const state = {} as Record<string | number | symbol, unknown>;

  STATE.set(model, state);

  args = args.flat().filter((arg) => {
    if (typeof arg == 'string') ID.set(model, arg);
    else return true;
  });

  addListener(model, () => {
    if (!PARENT.has(model)) PARENT.set(model, null);

    for (const key in model) {
      const desc = Object.getOwnPropertyDescriptor(model, key)!;

      if ('value' in desc) manage(model, key, desc.value, true);
    }

    for (const arg of args) {
      const use =
        typeof arg == 'function'
          ? arg.call(model, model)
          : (arg as State.Assign<State>);

      if (use instanceof Promise)
        use.catch((err) => {
          console.error(`Async error in constructor for ${model}:`);
          console.error(err);
        });
      else if (Array.isArray(use)) args.push(...use);
      else if (typeof use == 'function') addListener(model, use, null);
      else if (typeof use == 'object') assign(model, use, true);
    }

    addListener(
      model,
      () => {
        for (const [_, value] of model)
          if (value instanceof State && PARENT.get(value) === model)
            value.set(null);

        Object.freeze(state);
      },
      null
    );

    return null;
  });
}

function manage(
  target: State,
  key: string | number,
  value: any,
  silent?: boolean
) {
  const state = STATE.get(target)!;

  function get(this: State) {
    return follow(this, key, state[key]);
  }

  function set(value: unknown, silent?: boolean) {
    update(target, key, value, silent);
    if (value instanceof State && !PARENT.has(value)) {
      PARENT.set(value, target);
      event(value);
    }
  }

  define(target, key, { set, get });
  set(value, silent);
}

type Proxy<T = any> = (key: string | number, value: T) => T;

const OBSERVER = new WeakMap<State, Proxy>();

function follow(from: State, key: string | number, value?: any) {
  const observe = OBSERVER.get(from);
  return observe ? observe(key, value) : value;
}

function access(subject: State, property: string, required?: boolean) {
  const state = STATE.get(subject)!;

  if (property in state || required === false) {
    const value = state[property];

    if (value !== undefined || !required) return value;
  }

  if (METHODS.get(subject.constructor)!.has(property))
    return METHOD.get((subject as any)[property]);

  const error = new Error(`${subject}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    addListener(subject, (key) => {
      if (key === property) {
        resolve(state[key]);
        return null;
      }

      if (key === null) {
        reject(new Error(`${subject} is destroyed.`));
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

function update<T>(
  subject: State,
  key: string | number | symbol,
  value: T,
  arg?: boolean | State.Setter<T>
) {
  const state = STATE.get(subject)!;

  if (Object.isFrozen(state))
    throw new Error(
      `Tried to update ${subject}.${String(key)} but model is destroyed.`
    );

  const previous = state[key] as T;

  if (typeof arg == 'function') {
    const out = arg.call(subject, value, previous);

    if (out === false) return false;

    if (typeof out == 'function') value = out();
  }

  if (value === previous && key in state) return;

  state[key] = value;

  if (arg !== true) event(subject, key);

  return true;
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid() {
  return (0.278 + Math.random() * 0.722)
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

export { event, METHOD, State, PARENT, STATE, uid, access, update, follow };
