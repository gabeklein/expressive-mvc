import { addListener, effect, event, OnUpdate, queue, watch } from './control';

let FLATTEN: Map<any, any> | undefined;

/** Register for all active models via string identifiers (usually unique). */
const NAMES = new WeakMap<Model, string>();

/** Internal state assigned to controllers. */
const STATE = new WeakMap<Model, Record<string | number | symbol, unknown>>();

/** External listeners for any given Model. */
const NOTIFY = new WeakMap<Model.Type, Set<OnUpdate>>();

/** Update register. */
const PENDING = new WeakMap<Model, Set<string | number | symbol>>();

/** Parent-child relationships. */
const PARENT = new WeakMap<Model, Model>();

/** Reference bound instance methods to real ones. */
const METHOD = new WeakMap<any, any>();

const define = Object.defineProperty;

declare namespace Model {
  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A type of Model which may be created without constructor arguments. */
  type New<T extends Model = Model> = (new (arg?: Argument) => T) & typeof Model;

  /**
   * Model constructor callback - is called when Model finishes intializing.
   * Returned function will call when model is destroyed.
   */
  type Callback<T extends Model = Model> = (this: T, thisArg: T) => (() => void) | Assign<T> | Promise<void> | void;

  /** Model constructor argument */
  type Argument<T extends Model = Model> = string | Callback<T> | Assign<T> | undefined;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Field<T> = Exclude<keyof T, keyof Model>;

  /** Any valid key for controller, including but not limited to Field<T>. */
  type Event<T> = Field<T> | (string & {}) | number | symbol;

  /** Object overlay which may be used to override values and methods while creating model. */
  type Assign<T> = {
    [K in Exclude<keyof T, keyof Model>]?: T[K] extends (...args: any[]) => infer R 
      ? (this: T, ...args: Parameters<T[K]>) => ReturnType<T[K]> 
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

  namespace Instruction {
    type Getter<T> = (source: Model) => T;
    type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

    type Descriptor<T = any> = {
      get?: Getter<T> | boolean;
      set?: Setter<T> | false;
      enumerable?: boolean;
      value?: T;
    }
  }

  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T = any, M extends Model = any> =
    // TODO: Should this allow for numbers/symbol properties?
    (this: M, key: Field<M> & string, thisArg: M, state: State<M>) =>
      Instruction.Descriptor<T> | Instruction.Getter<T> | void;
}

interface Model {
  /**
   * Loopback to instance of this model. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

class Model {
  constructor(arg?: Model.Argument){
    const state = {} as Record<string | number | symbol, unknown>;
    let Type = this.constructor as Model.Type;
    
    bindMethods(Type);
    define(this, "is", { value: this });

    STATE.set(this, state);
    NAMES.set(this, typeof arg == 'string' ? arg : `${Type}-${uid()}`);

    while(true){
      new Set(NOTIFY.get(Type)).forEach(x => addListener(this, x));

      if(Type === Model)
        break;

      Type = Object.getPrototypeOf(Type);
    }

    addListener(this, () => {
      const apply = typeof arg == "function"
        ? arg.call(this, this) : arg;

      if(apply instanceof Promise)
        apply.catch(err => {
          console.error(`Async error in constructor for ${this}:`);
          console.error(err);
        });
      else if(typeof apply == "object")
        assign(this, apply);

      for(const key in this){
        const desc = Object.getOwnPropertyDescriptor(this, key)!;
    
        if("value" in desc){
          state[key] = desc.value;
          define(this, key, {
            configurable: false,
            set: (x) => update(this, key, x),
            get(){
              return watch(this, key, state[key]);
            }
          });
        }
      }
    
      addListener(this, () => {
        for(const [_, value] of this)
          if(value instanceof Model && PARENT.get(value) === this)
            value.set(null);

        if(typeof apply == "function")
          apply();
        
        Object.freeze(state);
      }, null);
    
      return null;
    });
  }

  /** Pull current values from state. Flattens all models and exotic values recursively. */
  get(): Model.State<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   * 
   * @param effect - Function to run, and again whenever accessed values change.
   * If effect returns a function, it will be called when a change occurs (syncronously),
   * effect is cancelled, or parent controller is destroyed.
   * 
   * @returns Function to cancel listener.
   */
  get(effect: Model.Effect<this>): () => void;

  /**
   * Get value of a property.
   * 
   * @param key - Property to get value of.
   * @param required - If true, will throw an error if property is not available.
   */
  get<T extends Model.Event<this>>(key: T, required?: boolean): Model.Value<this, T>;

  /**
   * Run a function when a property is updated.
   * 
   * @param key - Property to watch for updates.
   * @param callback - Function to call when property is updated.
   */
  get<T extends Model.Event<this>>(key: T, callback: Model.OnUpdate<this, T>): () => void;

  /**
   * Check if model is expired.
   * 
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

    if(arg1 === undefined){
      const values = {} as any;
      const current = !FLATTEN && (FLATTEN = new Map([[self, values]]));

      type Exportable = Iterable<[string, { get?: () => any }]>;

      for(let [key, value] of self as Exportable){
        if(FLATTEN.has(value))
          value = FLATTEN.get(value);
        else if(value && typeof value.get === "function")
          FLATTEN.set(value, value = value.get());

        values[key] = value;
      }

      if(current)
        FLATTEN = undefined;

      return Object.freeze(values);
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
   */
  set(assign: Model.Assign<this>): PromiseLike<Model.Event<this>[]> | undefined;

  /**
   * Update a property with value. 
   * 
   * @param key - property to update
   * @param value - value to update property with (if the same as current, no update will occur)
   * @param silent - if true, will not notify listeners of an update
   */
  set<K extends string>(key: K, value?: Model.Value<this, K>, silent?: boolean): PromiseLike<Model.Event<this>[]> | undefined;

  set(arg1?: Model.OnEvent<this> | Model.Assign<this> | string | number | symbol | null, arg2?: unknown, arg3?: boolean){
    const self = this.is;

    if(typeof arg1 == "function")
      return addListener(self, key => {
        if(typeof key == "string")
          return arg1.call(self, key, self);
      })

    if(arg1 === null)
      return event(this, null);

    if(typeof arg1 == "object")
      assign(self, arg1);

    else if(arg1 !== undefined)  
      if(1 in arguments)
        update(self, arg1, arg2, arg3);
      else
        push(self, arg1);

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

  /** Iterate over managed properties in this instance of Model. */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Creates a new instance of this controller.
   * 
   * **Important** - Use instead of `new this(...)` as this method also activates state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends Model> (this: Model.New<T>, arg?: Model.Argument<T>){
    const instance = new this(arg as Model.Argument<Model>);
    event(instance, true);
    return instance;
  }

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Type> (this: T, maybe: any): maybe is T {
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

  static at<T extends Model>(
    this: Model.Type<T>,
    from: Model, 
    cb: (got: T | undefined) => void){

    throw new Error(`Using context requires an adapter. If you are only testing, define \`get.context\` to simulate one.`);
  }
}

define(Model.prototype, "toString", {
  value(){
    return NAMES.get(this.is);
  }
});

define(Model, "toString", {
  value(){
    return this.name;
  }
});

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

function update(
  subject: Model,
  key: string | number | symbol,
  value: unknown,
  silent?: boolean){

  const state = STATE.get(subject)!;

  if(Object.isFrozen(state))
    throw new Error(`Tried to update ${String(key)} but ${subject} is destroyed.`);

  const previous = state[key];

  if(value === previous)
    return true;

  state[key] = value;

  if(silent !== true)
    push(subject, key);
}

function push(
  subject: Model,
  key: string | number | symbol,
  silent?: boolean){

  let pending = PENDING.get(subject);

  if(!pending){
    PENDING.set(subject, pending = new Set());

    if(!silent)
      queue(() => {
        event(subject, false);
        PENDING.delete(subject)
      })
  }

  pending.add(key);

  if(!silent)
    event(subject, key);
}

const METHODS = new WeakMap<Model.Type, string[]>([[Model, []]]);

function assign<T extends Model>(to: T, values: Model.Assign<T>){
  const methods = METHODS.get(to.constructor as Model.Type)!;
  const applicable = new Set(Object.keys(to).concat(methods));

  for(const key in values)
    if(applicable.has(key))
      to[key as keyof T] = values[key as Model.Field<T>] as any;
}

function bindMethods<T extends Model>(type: Model.Type<T>): string[] {
  let keys = METHODS.get(type);

  if(!keys){
    METHODS.set(type, keys = bindMethods(Object.getPrototypeOf(type)).slice());

    const desc = Object.getOwnPropertyDescriptors(type.prototype);

    for(const key in desc)
      if(key != "constructor" && "value" in desc[key]){
        let { value } = desc[key];

        keys.push(key);
        Object.defineProperty(type.prototype, key, {
          set: bind,
          get(){
            return this.hasOwnProperty(key) ? value : bind.call(this, value)
          }
        });
      
        function bind(this: Model, method: Function){
          const value = method.bind(this.is);
          
          METHOD.set(value, method);
          define(this.is, key, { value, writable: true });
          
          return value;
        }
      }
  }
  
  return keys;
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  update,
  fetch,
  push,
  METHOD,
  Model,
  PARENT,
  STATE,
  uid
}