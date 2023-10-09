import { addListener, effect, event, OnUpdate, queue, watch } from './control';

const ID = new WeakMap<Model, string>();
const PARENT = new WeakMap<Model, Model>();
const STATE = new WeakMap<Model, Record<string, unknown>>();
const NOTIFY = new WeakMap<Model.Type, Set<OnUpdate>>();
const PENDING = new WeakMap<Model, Record<symbol | string, unknown>>();

const define = Object.defineProperty;

declare namespace Model {
  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A type of Model which may be created without constructor arguments. */
  type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Field<T> = Exclude<keyof T, keyof Model>;

  type Key<T> = Field<T> | (string & {}) | number | symbol;

  /** Actual value stored in state. */
  type Actual<R> =
    R extends Ref<infer T> ? T :
    R extends Model ? State<R> :
    R;

  type Value<T extends Model, K extends Key<T>> =
    K extends keyof T ? T[K] extends Ref<infer V> ? V : T[K] : unknown;

  type OnUpdate<T extends Model, K extends Key<T>> =
    (this: T, value: Value<T, K>, key: K, thisArg: K) => void;

  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.
   */
  type State<T> = { [P in Field<T>]: Actual<T[P]> };

  /** Object comperable to data found in T. */
  type Values<T> = { [P in Field<T>]?: Actual<T[P]> };

  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** A callback function which is subscribed to parent and updates when values change. */
  type Effect<T> = (this: T, argument: T) => ((update: boolean | null) => void) | Promise<void> | null | void;

  type Event<T extends Model> =
    (this: T, key: unknown, source: T) => (() => void) | void | null;

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
    (this: M, key: Model.Field<M> & string, thisArg: M, state: Model.State<M>) =>
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
  constructor(id?: string | number){
    let Type = this.constructor as Model.Type;
    const state = {} as Record<string, unknown>;

    define(this, "is", { value: this });

    STATE.set(this, state);
    ID.set(this, id ? String(id) : `${Type}-${uid()}`);

    while(true){
      new Set(NOTIFY.get(Type)).forEach(x => addListener(this, x));

      if(Type === Model)
        break;

      Type = Object.getPrototypeOf(Type);
    }

    const remove = addListener(this, (key) => {
      remove();

      if(key !== true)
        event(this, true);

      for(const key in this){
        const desc = Object.getOwnPropertyDescriptor(this, key)!;

        if("value" in desc){
          state[key] = desc.value;
          define(this, key, {
            enumerable: true,
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
        
        Object.freeze(state);
      }, null);
    });
  }

  /** Pull current values from state. Flattens all models and exotic values recursively. */
  get(): Model.State<this>;

  /** Run a function which will run automatically when accessed values change. */
  get(effect: Model.Effect<this>): () => void;

  /** Check if model is expired. */
  get(status: null): boolean;

  /** Callback when model is to be destroyed. */
  get(status: null, callback: () => void): () => void;

  get<T extends Model.Key<this>>(key: T, required?: boolean): Model.Value<this, T>;

  get<T extends Model.Key<this>>(key: T, callback: Model.OnUpdate<this, T>): () => void;

  get(arg1?: Model.Effect<this> | string | null, arg2?: boolean | Function){
    const self = this.is;

    if(typeof arg1 == "function")
      return effect(self, arg1);

    if(arg1 === undefined){
      const cache = new WeakMap<Model, any>();

      function get(value: any){
        if(value instanceof Model){
          if(cache.has(value))
            return cache.get(value);

          const model = value;

          cache.set(value, value = {});

          for(const [key, val] of model)
            value[key] = get(val);
        }

        return value;
      }

      return get(self);
    }

    if(arg1 === null)
      if(typeof arg2 == "function")
        return addListener(self, arg2.bind(this, this), null);
      else
        return Object.isFrozen(STATE.get(self));

    if(typeof arg2 == "function"){
      const state = STATE.get(self)!;

      if(arg1 in state)
        arg2.call(this, state[arg1], arg1, this)
      
      return addListener(self, () => {
        arg2.call(this, arg1 in state ? state[arg1] : arg1, arg1, this)
      }, arg1)
    }
    else
      return fetch(self, arg1, arg2);
  }

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values. Is `undefined` if there is no update.
   **/
  set(): Promise<Model.Values<this>> | undefined;

  /**
   * Call a function when update occurs.
   * 
   * Given function is called for every assignment (which changes value) or explicit `set`.
   * To run logic on final value only, callback itself may return a function.
   * Returning the same function for one or more events will ensure a side-effect is called only when settled.
   * 
   * @param callback - Function to call when update occurs.
   * @returns Function to remove listener. Will return `true` if removed, `false` if inactive already.
  */
  set(callback: Model.Event<this>): () => boolean;

  /**
   * Declare an end to updates. This event is final and will freeze state.
   */
  set(status: null): void;

  /**
   * Push an update. This will not change the value of associated property.
   * 
   * Useful where a property value internally has changed, but the object is the same.
   * For example: An array has pushed a new value, or a nested property is updated.
   */
  set(key: Model.Key<this>): void;

  /**
   * Update a property with value. 
   * 
   * @param key - property to update
   * @param value - value to update property with (if the same as current, no update will occur)
   * @param silent - if true, will not notify listeners of an update
   */
  set<K extends string>(key: K, value?: Model.Value<this, K>, silent?: boolean): void;

  set(arg1?: Model.Event<this> | string | number | symbol | null, arg2?: unknown, arg3?: boolean){
    const self = this.is;

    if(typeof arg1 == "function")
      return addListener(self, key => {
        if(typeof key == "string")
          return arg1.call(self, key, self);
      })

    if(arg1 !== undefined)
      return 1 in arguments
        ? update(self, arg1, arg2, arg3)
        : update(self, arg1);

    if(!PENDING.has(self))
      return;

    return new Promise(resolve => {
      const remove = addListener(this, (key) => {
        if(key !== true){
          remove();
          return resolve.bind(null, PENDING.get(self));
        }
      });
    });
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
  static new <T extends typeof Model> (this: T, ...args: ConstructorParameters<T>){
    const instance = new this(...args);
    event(instance, true);
    return instance as InstanceType<T>;
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

  static on<T extends Model>(this: Model.Type<T>, event: Model.Event<T>){
    let notify = NOTIFY.get(this);

    if(!notify)
      NOTIFY.set(this, notify = new Set());

    notify.add(event);

    return () => notify!.delete(event);
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
  key: string | number | symbol | null,
  value?: unknown,
  silent?: boolean){

  const state = STATE.get(subject)!;
  let pending = PENDING.get(subject);

  if(typeof key == "boolean")
    throw new Error("Boolean keys are internal only.");

  if(Object.isFrozen(state))
    throw new Error(`Tried to update ${String(key)} but ${subject} is destroyed.`);

  if(typeof key == "string" && 2 in arguments){
    const previous = state[key];

    if(value === previous)
      return true;
  
    state[key] = value;

    if(silent === true)
      return;
  }

  if(key){
    if(!pending){
      PENDING.set(subject, pending = {});

      queue(() => {
        event(subject, false);
        PENDING.delete(subject)
      })
    }

    pending[key as string] = key in state ? value : true;
  }

  event(subject, key);
}

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  update,
  fetch,
  Model,
  PARENT,
  STATE,
  uid
}