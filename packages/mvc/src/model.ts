import { addListener, event, watch, queue, subscribe } from './control';

type Predicate = (key: string) => boolean | void;
type InstructionRunner = (
  on: Model,
  key: string,
  state: Record<string, unknown>
) => PropertyDescriptor | void;

const ID = new WeakMap<Model, string>();
const PARENT = new WeakMap<Model, Model>();
const INSTRUCT = new Map<symbol, InstructionRunner>();
const PENDING = new WeakMap<Model, Record<string, unknown>>();
const STATE = new WeakMap<Model, Record<string, unknown>>();

declare namespace Model {
  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A type of Model which may be created without constructor arguments. */
  type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Key<T> = Exclude<keyof T, keyof Model> & string;

  type Any<T> = Exclude<keyof T, keyof Model> | (string & {});

  /** Actual value stored in state. */
  type Value<R> =
    R extends Ref<infer T> ? T :
    R extends Model ? Export<R> :
    R;

  type ValueOf<T extends Model, K extends Any<T>> =
    K extends keyof T ? T[K] extends Ref<infer V> ? V : T[K] : unknown;

  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill
   * into "real" values held by exotics like ref.
   */
  type Export<T> = { [P in Key<T>]: Value<T[P]> };

  /** Object comperable to data found in T. */
  type Values<T> = { [P in Key<T>]?: Value<T[P]> };

  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
    (next: T): void;
    current: T | null;
  }

  /** A callback function which is subscribed to parent and updates when values change. */
  type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | null | void;

  type Event = (key: string) => Callback | void;

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
    (this: M, key: Model.Key<M>, thisArg: M, state: Model.Export<M>) =>
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
    const state = {} as Record<string, unknown>;

    Object.defineProperty(this, "is", { value: this });

    ID.set(this, `${this.constructor}-${id ? String(id) : uid()}`);
    STATE.set(this, state);
    
    function onNull(key: unknown){
      if(key === null)
        Object.freeze(state);
    }

    addListener(this, () => {
      for(const key in this){
        const { value } = Object.getOwnPropertyDescriptor(this, key)!;
        const instruction = INSTRUCT.get(value);
        let desc: PropertyDescriptor | void = {
          enumerable: true,
          set: update.bind(null, this, key),
          get(){
            return watch(this, key, state[key]);
          }
        }

        if(instruction){
          INSTRUCT.delete(value);
          delete (this as any)[key];
          desc = instruction(this, key, state);
        }
        else
          state[key] = value;

        if(desc)
          Object.defineProperty(this, key, desc);
      }

      addListener(this, onNull);
      return null;
    });
  }

  /** Pull current values from state. Flattens all models and exotic values amongst properties. */
  get(): Model.Export<this>;

  /** Run a function which will run automatically when accessed values change. */
  get(effect: Model.Effect<this>): Callback;

  get<T extends string>(key: T, required: true): Exclude<Model.ValueOf<this, T>, undefined>;

  get<T extends string>(key: T, required?: boolean): Model.ValueOf<this, T>;

  get(arg1?: Model.Effect<this>, arg2?: boolean){
    const self = this.is;

    if(typeof arg1 == "string")
      return fetch(self, arg1, arg2);

    if(arg1)
      return effect(self, arg1);

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

  /**
   * Check if update is in progress.
   * Returns a promise which resolves updated keys. If no update, will resolve `false`.
   **/
  set(): Promise<Model.Values<this> | false>;

  /**
   * Expect an update to state within a set timeout.
   * 
   * @param timeout - milliseconds to wait for update
   * @param predicate - optional function to filter for specific updates. If returns true, update is accepted.
   * 
   * @returns a promise to resolve when next accepted update has occured.
   */
  set(timeout: number, predicate?: Predicate): Promise<Model.Values<this>>;

  /**
   * Call a function whenever an update to state has occured.
   * 
   * @param callback - Function to call when any update occurs. 
   *   Note: This will be called for every assignment which changes the value.
   *   To run logic on final value only, this callback may return a function.
   *   Returning the same function for the same (or multiple for that matter)
   *   will ensure it is only called once.
   *
   * @returns a function to remove listener. Will return true if listener did exist.
  */
  set(callback: Model.Event): () => boolean;

  /**
   * Push an update without changing the value of associated property.
   * 
   * This is useful where a property value internally has changed, but the object remains the same.
   * For example: an array which has pushed a new value, or change to nested properties.
   */
  set(key: string | null): void;

  /**
   * Update a property programatically within state. 
   * 
   * @param key - property to update
   * @param value - value to update property with (if the same as current, no update will occur)
   * @param silent - if true, will not notify listeners of an update
   */
  set<K extends string>(key: K, value?: Model.ValueOf<this, K>, silent?: boolean): void;

  set(arg1?: Model.Event | number | string | null, arg2?: Predicate | unknown, arg3?: boolean){
    const self = this.is;

    if(typeof arg1 == "function")
      return addListener(self, key => {
        if(typeof key == "string")
          return arg1(key)
      })

    if(typeof arg1 == "string" || arg1 === null)
      return 1 in arguments
        ? update(self, arg1, arg2, arg3)
        : update(self, arg1);

    return new Promise<any>((resolve, reject) => {
      if(typeof arg1 != "number" && !PENDING.has(self)){
        resolve(false);
        return;
      }
  
      const remove = addListener(this, (key) => {
        if(key === true || typeof arg2 == "function" && typeof key == "string" && arg2(key) !== true)
          return;
  
        if(timeout)
          clearTimeout(timeout);
  
        remove();
  
        return resolve.bind(null, PENDING.get(self));
      });
  
      const timeout = typeof arg1 == "number" && setTimeout(() => {
        remove();
        reject(arg1);
      }, arg1);
    });
  }

  /** Iterate over managed properties in this instance of Model. */
  [Symbol.iterator](): Iterator<[string, unknown]> {
    return Object.entries(STATE.get(this.is)!)[Symbol.iterator]();
  }

  /**
   * Creates a new instance of this controller.
   * 
   * Beyond `new this(...)`, method will activate managed-state.
   * 
   * @param args - arguments sent to constructor
   */
  static new <T extends typeof Model> (
    this: T, ...args: ConstructorParameters<T>
  ){
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
  static is<T extends Model.Type>(this: T, maybe: any): maybe is T {
    return typeof maybe == "function" && maybe.prototype instanceof this;
  }
}

Object.defineProperty(Model.prototype, "toString", {
  value(){
    return ID.get(this.is);
  }
});

Object.defineProperty(Model, "toString", {
  value(){
    return this.name;
  }
});

function add<T = any, M extends Model = any>(instruction: Model.Instruction){
  const placeholder = Symbol("instruction");

  INSTRUCT.set(placeholder, (subject, key, state) => {
    const output = instruction.call(subject, key, subject, state);
  
    if(!output)
      return;

    const desc = typeof output == "object" ? output : { get: output };
    const { enumerable = true } = desc;

    if("value" in desc)
      state[key] = desc.value;

    return {
      enumerable,
      set(next){
        let { set } = desc;

        if(set === false)
          throw new Error(`${subject}.${key} is read-only.`);

        if(typeof set == "function"){
          const result = set.call(subject, next, state[key]);

          if(result === false)
            return;

          if(typeof result == "function")
            next = result();

          set = false;
        }

        update(subject, key, next, !!set);
      },
      get(this: M){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(subject, key, desc.get)
        );
      }
    }
  });

  return placeholder as unknown as T;
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

function update(
  subject: Model,
  key: string | boolean | null,
  value?: unknown,
  silent?: boolean){

  const state = STATE.get(subject)!;
  let pending = PENDING.get(subject);

  if(typeof key == "string"){
    if(2 in arguments){
      const previous = state[key];

      if(value === previous)
        return true;
  
      state[key] = value;

      if(silent === true)
        return;
    }

    if(!pending){
      PENDING.set(subject, pending = {});

      queue(() => {
        event(subject, false);
        PENDING.delete(subject)
      })
    }

    const skip = key in pending;

    pending[key] = state[key];

    if(skip)
      return;
  }

  event(subject, key);
}

function effect<T extends Model>(
  target: T,
  callback: Model.Effect<T>){

  let refresh: (() => void) | null | undefined;
  let unSet: Callback | false | undefined;

  function invoke(){
    try {
      const out = callback.call(target, target);

      unSet = typeof out == "function" && out;
      refresh = out === null ? out : invoke;
    }
    catch(err){
      if(err instanceof Promise){
        refresh = undefined;
        err.then(invoke).catch(console.error);
      }
      else if(refresh)
        console.error(err);
      else
        throw err;
    }
  }

  target = subscribe(target, () => {
    if(refresh && unSet){
      unSet();
      unSet = undefined;
    }
    return refresh;
  });

  addListener(target, key => {
    if(key === true)
      invoke();

    else if(!refresh)
      return refresh;

    if(key === null && unSet)
      unSet();
  });

  return () => {
    refresh = null;
  };
}

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  add,
  fetch,
  Model,
  PARENT,
  uid
}