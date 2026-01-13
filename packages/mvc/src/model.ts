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
const ID = new WeakMap<Model, string>();

/** Internal state assigned to models. */
const STATE = new WeakMap<Model, Record<string | number | symbol, unknown>>();

/** External listeners for any given Model. */
const NOTIFY = new WeakMap<Type, Set<Notify>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<Model, Model | null>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Function, Map<string, (value: any) => void>>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child models. */
let EXPORT: Map<any, any> | undefined;

declare namespace Model {
  /**
   * Model which is valid to create.
   * If implements new method, it must have correct signature.
   **/
  interface New extends Model {
    'new'?(): void | (() => void);
  }

  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends New = Model> = (abstract new (...args: any[]) => T) &
    typeof Model;

  /** A Model constructor, but which is not abstract. */
  type Init<T extends New = Model> = (new (...args: Model.Args<T>) => T) &
    Omit<typeof Model, never>;

  /**
   * Model constructor callback - is called when Model finishes intializing.
   * Returned function will run when model is destroyed.
   */
  type Callback<T extends Model = Model> = (
    this: T,
    thisArg: T
  ) => Promise<void> | (() => void) | Args<T> | Assign<T> | void;

  /** Model constructor arguments */
  type Args<T extends Model = any> = (
    | Args<T>
    | Assign<T>
    | Callback<T>
    | string
    | void
  )[];

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Field<T> = Exclude<keyof T, keyof Model>;

  /** Any valid key for model, including but not limited to Field<T>. */
  type Event<T> = Field<T> | number | symbol | (string & {});

  /** Object overlay to override values and methods on a model. */
  type Assign<T> = Record<string, unknown> & {
    [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
      ? (this: T, ...args: A) => R
      : T[K];
  };

  /** Export/Import compatible value for a given property in a Model. */
  type Export<R> = R extends { get(): infer T } ? T : R;

  /** Value for a property managed by a model. */
  type Value<T extends Model, K extends Event<T>> = K extends keyof T
    ? Export<T[K]>
    : unknown;

  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type OnEvent<T extends Model> = (
    this: T,
    key: unknown,
    source: T
  ) => void | (() => void) | null;

  type OnUpdate<T extends Model, K extends Event<T>> = (
    this: T,
    key: K,
    thisArg: K
  ) => void;

  /**
   * Values from current state of given model.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.Object.
   */
  type State<T> = { [P in Field<T>]: Export<T[P]> };

  /** Object comperable to data found in T. */
  type Values<T> = { [P in Field<T>]?: Export<T[P]> };

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

interface Model {
  /**
   * Loopback to instance of this model. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

abstract class Model implements Observable {
  constructor(...args: Model.Args) {
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
  get(): Model.State<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   *
   * @param effect Function to run, and again whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent model is destroyed.
   * @returns Function to cancel listener.
   */
  get(effect: Model.Effect<this>): () => void;

  /**
   * Get value of a property.
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
   * Run a function when a property is updated.
   *
   * @param key - Property to watch for updates.
   * @param callback - Function to call when property is updated.
   * @returns Function to cancel listener.
   */
  get<T extends Model.Event<this>>(
    key: T,
    callback: Model.OnUpdate<this, T>
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
    arg1?: Model.Effect<this> | string | null,
    arg2?: boolean | Model.OnUpdate<this, any>
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
      let pending = new Set<Model.Event<this>>();

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
  set(): PromiseLike<Model.Event<this>[]> | undefined;

  /**
   * Update mulitple properties at once. Merges argument with current state.
   * Properties which are not managed by this model will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If an update does occur, listeners will not be refreshed automatically.
   * @returns Promise resolving an array of keys updated, `undefined` (immediately) if a noop.
   */
  set(
    assign?: Model.Assign<this>,
    silent?: boolean
  ): PromiseLike<Model.Event<this>[]> | undefined;

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
  set(key: Model.Event<this>): PromiseLike<Model.Event<this>[]>;

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
    key: Model.Event<this>,
    value: unknown,
    init?: boolean
  ): PromiseLike<Model.Event<this>[]>;

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
  set(callback: Model.OnEvent<this>): () => boolean;

  /**
   * Call a function when a property is updated.
   * Unlike `get`, this calls synchronously and will fire as many times as the property is updated.
   *
   * @param callback - Function to call when property is updated.
   * @param event - Property to watch for updates.
   */
  set(
    callback: Model.OnEvent<this>,
    event: Model.Event<this> | null
  ): () => boolean;

  /**
   * Declare an end to updates. This event is final and will freeze state.
   * This event can be watched for as well, to run cleanup logic and internally will remove all listeners.
   *
   * @param status - `null` to end updates.
   */
  set(status: null): void;

  set(
    arg1?: Model.OnEvent<this> | Model.Assign<this> | Model.Event<this> | null,
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
      return <PromiseLike<Model.Event<this>[]>>{
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
   * Iterate over managed properties in this instance of Model.
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
  static new<T extends Model>(
    this: Model.Init<T & Model.New>,
    ...args: Model.Args<T>
  ) {
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
  static is<T extends Model.Type>(this: T, maybe: unknown): maybe is T {
    return (
      maybe === this ||
      (typeof maybe == 'function' && maybe.prototype instanceof this)
    );
  }

  /**
   * Register a callback to run when any instance of this Model is updated.
   */
  static on<T extends Model>(this: Model.Type<T>, listener: Model.OnEvent<T>) {
    let notify = NOTIFY.get(this);

    if (!notify) NOTIFY.set(this, (notify = new Set()));

    notify.add(listener);

    return () => notify.delete(listener);
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

function assign(subject: Model, data: Model.Assign<Model>, silent?: boolean) {
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
function prepare(model: Model) {
  let T = model.constructor as Model.Type;

  if (T === Model) throw new Error('Cannot create base Model.');

  const chain = [] as Model.Type[];
  let keys = new Map<string, (value: any) => void>();

  ID.set(model, `${T}-${uid()}`);

  while (T.name) {
    for (const cb of NOTIFY.get(T) || []) {
      addListener(model, cb);
    }

    if (T === Model) break;
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

      function bind(this: Model, original?: Function) {
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
function init(model: Model, args: Model.Args) {
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
          : (arg as Model.Assign<Model>);

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
          if (value instanceof Model && PARENT.get(value) === model)
            value.set(null);

        Object.freeze(state);
      },
      null
    );

    return null;
  });
}

function manage(
  target: Model,
  key: string | number,
  value: any,
  silent?: boolean
) {
  const state = STATE.get(target)!;

  function get(this: Model) {
    return follow(this, key, state[key]);
  }

  function set(value: unknown, silent?: boolean) {
    update(target, key, value, silent);
    if (value instanceof Model && !PARENT.has(value)) {
      PARENT.set(value, target);
      event(value);
    }
  }

  define(target, key, { set, get });
  set(value, silent);
}

type Proxy<T = any> = (key: string | number, value: T) => T;

const OBSERVER = new WeakMap<Model, Proxy>();

function follow(from: Model, key: string | number, value?: any) {
  const observe = OBSERVER.get(from);
  return observe ? observe(key, value) : value;
}

function access(subject: Model, property: string, required?: boolean) {
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
  subject: Model,
  key: string | number | symbol,
  value: T,
  arg?: boolean | Model.Setter<T>
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

export { event, METHOD, Model, PARENT, STATE, uid, access, update, follow };
