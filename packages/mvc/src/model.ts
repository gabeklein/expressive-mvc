import { addListener, effect, emit, OnUpdate, queue, watch } from './control';

const define = Object.defineProperty;

/** Register for all active models via string identifiers (usually unique). */
const ID = new WeakMap<Model, string>();

/** Internal state assigned to controllers. */
const STATE = new WeakMap<Model, Record<string | number | symbol, unknown>>();

/** External listeners for any given Model. */
const NOTIFY = new WeakMap<Model.Type, Set<OnUpdate>>();

/** Update register. */
const PENDING = new WeakMap<Model, Set<string | number | symbol>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<Model, Model | null>();

/** List of methods defined by a given type. */
const METHODS = new WeakMap<Model.Type, Set<string>>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

/** Currently accumulating export. */
let EXPORT: Map<any, any> | undefined;

declare namespace Model {
  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends Model = Model> =
    (abstract new (...args: any[]) => T) & typeof Model;

  /** A Model constructor, but which is not abstract. */
  type Init<T extends Model = Model> =
    (new (...args: Model.Args<T>) => T) & Omit<typeof Model, never>;

  /**
   * Model constructor callback - is called when Model finishes intializing.
   * Returned function will call when model is destroyed.
   */
  type Callback<T extends Model = Model> =
    (this: T, thisArg: T) => Promise<void> | (() => void) | Assign<T> | void;

  /** Model constructor argument */
  type Argument<T extends Model = Model> = Assign<T> | Callback<T> | string | void;

  /** Model constructor arguments */
  type Args<T extends Model = any> = Argument<T>[];

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Field<T> = Exclude<keyof T, keyof Model>;

  /** Any valid key for controller, including but not limited to Field<T>. */
  type Event<T> = Field<T> | (string & {}) | number | symbol;

  /** Object overlay to override values and methods on a model. */
  type Assign<T> = {
    [K in Exclude<keyof T, keyof Model>]?:
      T[K] extends (...args: infer A) => infer R 
        ? (this: T, ...args: A) => R
        : T[K];
  } & Record<string, unknown>;

  /** Export/Import compatible value for a given property in a Model. */
  type Export<R> = R extends { get(): infer T } ? T : R;

  /** Value for a property managed by a controller. */
  type Value<T extends Model, K extends Event<T>> =
    K extends keyof T ? Export<T[K]> : unknown;

  type OnEvent<T extends Model> =
    (this: T, key: unknown, source: T) => (() => void) | void | null;

  type OnUpdate<T extends Model, K extends Event<T>> =
    (this: T, value: Value<T, K>, key: K, thisArg: K) => void;

  /**
   * Values from current state of given controller.
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
  }

  /**
   * A callback function which is subscribed to parent and updates when accessed properties change.
   * 
   * @param current - Current state of this controller. This is a proxy which detects properties which
   * where accessed, and thus depended upon to stay current.
   * 
   * @param update - Set of properties which have changed, and events fired, since last update.
   * 
   * @returns A callback function which will be called when this effect is stale.
   */
  type Effect<T> = (this: T, current: T, update: Set<Event<T>>) =>
    EffectCallback | Promise<void> | null | void;

  /**
   * A callback function returned by effect. Will be called when effect is stale.
   * 
   * @param update - `true` if update is pending, `false` effect has been cancelled, `null` if controller is destroyed.
   */
  type EffectCallback = ((update: boolean | null) => void);

  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T = any, M extends Model = any> =
    // TODO: Should this allow for numbers/symbol properties?
    (this: M, key: Extract<Field<M>, string>, thisArg: M, state: State<M>) =>
      Descriptor<T> | ((source: M) => T) | void;

  type Getter<T> = (source: Model) => T;
  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type Descriptor<T = any> = {
    get?: Getter<T> | boolean;
    set?: Setter<T> | boolean;
    enumerable?: boolean;
    value?: T;
  }
}

interface Model {
  /**
   * Loopback to instance of this model. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

abstract class Model {
  constructor(...args: Model.Args){
    define(this, "is", { value: this });
    ID.set(this, `${this.constructor}-${uid()}`);
    STATE.set(this, {});

    prepare(this);
    init(this, args);
  }

  /**
   * Pull current values from state. Flattens all models and exotic values recursively.
   * 
   * @returns Object with all values from this controller.
   **/
  get(): Model.State<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   * 
   * @param effect Function to run, and again whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent controller is destroyed.
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
  get<T extends Model.Event<this>>(key: T, required?: boolean): Model.Value<this, T>;

  /**
   * Run a function when a property is updated.
   * 
   * @param key - Property to watch for updates.
   * @param callback - Function to call when property is updated.
   * @returns Function to cancel listener.
   */
  get<T extends Model.Event<this>>(key: T, callback: Model.OnUpdate<this, T>): () => void;

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

  get(arg1?: Model.Effect<this> | string | null, arg2?: boolean | Function){
    const self = this.is;

    if(arg1 === undefined)
      return values(self);

    if(typeof arg1 == "function"){
      let pending = new Set<Model.Event<this>>();

      return effect(self, (state) => {
        const cb = arg1.call(state, state, pending);

        return cb === null ? cb : ((update) => {
          pending = PENDING.get(self)!;
          if(typeof cb == "function")
            return cb(update);
        })
      });
    }

    if(typeof arg2 == "function"){
      if(arg1 === null)
        return addListener(self, arg2.bind(this, this), null);

      const state = STATE.get(self)!;

      if(arg1 in state)
        arg2.call(this, state[arg1], arg1, this)

      return addListener(self, () => {
        arg2.call(this, arg1 in state ? state[arg1] : arg1, arg1, this)
      }, arg1)
    }

    return arg1 === null
      ? Object.isFrozen(STATE.get(self))
      : fetch(self, arg1, arg2);
  }

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values. Is `undefined` if there is no update.
   **/
  set(): PromiseLike<Model.Event<this>[]> | undefined;

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
   * Declare an end to updates. This event is final and will freeze state.
   * This event can be watched for as well, to run cleanup logic and internally will remove all listeners.
   * 
   * @param status - `null` to end updates.
   */
  set(status: null): void;

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
   * @returns Promise which resolves an array of keys which were updated.
   */
  set(key: Model.Event<this>): PromiseLike<Model.Event<this>[]>;

  /**
   * Update mulitple properties at once. Merges argument with current state.
   * Properties which are not managed by this controller will be ignored.
   * 
   * @param assign - Object with properties to update.
   * @returns Promise which resolves an array of keys which were updated.
   */
  set(assign: Model.Assign<this>): PromiseLike<Model.Event<this>[]> | undefined;

  /**
   * Update a property with value. 
   * 
   * @param key - property to update
   * @param value - value to update property with (if the same as current, no update will occur)
   * @param silent - if true, will not notify listeners of an update
   */
  set<K extends string>(
    key: K,
    value?: Model.Value<this, K>,
    silent?: boolean
  ): PromiseLike<Model.Event<this>[]> | undefined;

  set(
    arg1?: Model.OnEvent<this> | Model.Assign<this> | string | number | symbol | null,
    arg2?: unknown,
    arg3?: boolean){

    const self = this.is;

    if(typeof arg1 == "function")
      return addListener(self, key => {
        if(typeof key == "string")
          return arg1.call(self, key, self);
      })

    if(arg1 === null){
      emit(this, null);
      return
    }

    if(typeof arg1 == "object")
      assign(self, arg1);
    else if(arg1 == undefined)  
      emit(this, true);
    else if(1 in arguments)
      update(self, arg1, arg2, arg3);
    else
      event(self, arg1);

    if(PENDING.has(self))
      return <PromiseLike<Model.Event<this>[]>> {
        then: (res) => new Promise<any>(res => {
          const remove = addListener(self, key => {
            if(key !== true){
              remove();
              return res.bind(null, Array.from(PENDING.get(self)!));
            }
          });
        }).then(res)
      }
  }

  /**
   * Iterate over managed properties in this instance of Model.
   * Yeilds the key and underlying value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Create and activate a new instance of this controller.
   * 
   * **Important** - Unlike `new this(...)` - this method also activates state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends Model> (this: Model.Init<T>, ...args: Model.Args<T>){
    Model.is(this);
    const instance = new this(...args);
    emit(instance, true);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Type> (this: T, maybe: unknown): maybe is T {
    if(maybe === Model)
      throw new Error("Model is abstract and not a valid type.");

    return typeof maybe == "function" && maybe.prototype instanceof this;
  }

  /**
   * Register a callback to run when any instance of this Model is updated. 
   */
  static on<T extends Model>(
    this: Model.Type<T>, listener: Model.OnEvent<T>){

    let notify = NOTIFY.get(this);

    if(!notify)
      NOTIFY.set(this, notify = new Set());

    notify.add(listener);

    return () => notify!.delete(listener);
  }
}

define(Model.prototype, "toString", {
  value(){
    return ID.get(this.is);
  }
});

define(Model, "toString", {
  value(){
    return this.name;
  }
});

/** Apply instructions, inherited event listeners and ensure class metadata is ready. */
function prepare(model: Model){
  const chain = [] as Model.Type[];

  let type = model.constructor as Model.Type;
  let keys = new Set<string>();

  while(type.name){
    chain.unshift(type);
    type = Object.getPrototypeOf(type)
  }

  for(const type of chain){
    for(const cb of NOTIFY.get(type) || [])
      addListener(model, cb);

    if(type == Model)
      continue;

    if(METHODS.has(type)){
      keys = METHODS.get(type)!;
      continue;
    }

    METHODS.set(type, keys = new Set(keys));
  
    for(const { key, value } of entries(type.prototype)){
      if(!value || key == "constructor")
        continue;

      function set(this: Model, method: Function){
        const value = method.bind(this.is);
        
        METHOD.set(value, method);
        define(this.is, key, { value, writable: true });
        
        return value;
      }

      keys.add(key);
      Object.defineProperty(type.prototype, key, {
        set,
        get(){
          return this.hasOwnProperty(key)
            ? value : set.call(this, value)
        }
      });
    }
  }
}

/**
 * Apply model arguemnts, run callbacks and observe properties.
 * Accumulate and handle cleanup events.
 **/
function init(model: Model, args: Model.Args){
  const done = new Set<() => void>();
  const state = STATE.get(model)!;
  
  for(const arg of args)
    if(typeof arg == "string")
      ID.set(model, arg);

  addListener(model, () => {
    if(!PARENT.has(model))
      PARENT.set(model, null);

    for(const arg of args){
      const use = typeof arg == "function"
        ? arg.call(model, model)
        : arg;

      if(use instanceof Promise)
        use.catch(err => {
          console.error(`Async error in constructor for ${model}:`);
          console.error(err);
        });
      else if(typeof use == "object")
        assign(model, use);
      else if(typeof use == "function")
        done.add(use);
    }

    for(const key in model){
      const desc = Object.getOwnPropertyDescriptor(model, key)!;

      if("value" in desc){
        update(model, key, desc.value, true);
        define(model, key, {
          configurable: false,
          set: (x) => update(model, key, x),
          get(){
            return watch(this, key, state[key]);
          }
        });
      }
    }
  
    return null;
  });

  addListener(model, () => {
    done.forEach(x => x());

    for(const [_, value] of model)
      if(value instanceof Model && PARENT.get(value) === model)
        value.set(null);

    Object.freeze(state);
  }, null);
}

function fetch(subject: Model, property: string, required?: boolean){
  const state = STATE.get(subject)!;
  
  if(property in state || required === false){
    const value = state[property];

    if(value !== undefined || !required)
      return value;
  }

  const error = new Error(`${subject}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    addListener(subject, key => {
      if(key === property){
        resolve(state[key]);
        return null;
      }

      if(key === null)
        reject(new Error(`${subject} is destroyed.`));
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: "Suspense",
    message: error.message,
    stack: error.stack
  });
}

function update<T>(
  subject: Model,
  key: string | number | symbol,
  value: T,
  arg?: boolean | Model.Setter<T>){

  const state = STATE.get(subject)!;

  if(Object.isFrozen(state))
    throw new Error(`Tried to update ${String(key)} but ${subject} is destroyed.`);

  const previous = state[key] as T;

  if(typeof arg == "function"){
    const out = arg.call(subject, value, previous);

    if(out === false)
      return false;

    if(typeof out == "function")
      value = out();
  }

  if(value === previous)
    return true;

  if(value instanceof Model && !PARENT.has(value)){
    PARENT.set(value, subject);
    emit(value, true);
  }

  state[key] = value;

  if(arg !== true)
    event(subject, key);
}

function event(
  subject: Model,
  key: string | number | symbol,
  silent?: boolean){

  let pending = PENDING.get(subject);

  if(!pending){
    PENDING.set(subject, pending = new Set());

    if(!silent)
      queue(() => {
        emit(subject, false);
        PENDING.delete(subject)
      })
  }

  pending.add(key);

  if(!silent)
    emit(subject, key);
}

function assign<T extends Model>(to: T, values: Model.Assign<T>){
  const methods = METHODS.get(to.constructor as Model.Type)!;

  for(const key in values)
    if(key in to || methods.has(key))
      to[key as keyof T] = values[key as Model.Field<T>] as any;
}

function values<T extends Model>(model: T): Model.State<T> {
  const values = {} as any;
  const current = !EXPORT && (EXPORT = new Map([[model, values]]));

  type Exportable = Iterable<[string, { get?: () => any }]>;

  for(let [key, value] of model as Exportable){
    if(EXPORT.has(value))
      value = EXPORT.get(value);
    else if(value && typeof value.get === "function")
      EXPORT.set(value, value = value.get());

    values[key] = value;
  }

  if(current)
    EXPORT = undefined;

  return Object.freeze(values);
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

/** Get iterable decriptors of object, include key. */
function entries(object: {}){
  return Object.entries(
    Object.getOwnPropertyDescriptors(object)
  ).map(([key, desc]) => ({ key, ...desc }));
}

export {
  entries,
  fetch,
  METHOD,
  Model,
  PARENT,
  event as push,
  STATE,
  uid,
  update,
}