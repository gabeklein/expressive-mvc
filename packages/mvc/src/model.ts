import { Control, control, effect } from './control';

const ID = new WeakMap<Model, string>();
const PARENT = new WeakMap<Model, Model>();

type Predicate = (key: string) => boolean | void;

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

  type ValueOf<T extends Model, K extends Any<T>> = K extends keyof T ? T[K] : T;

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

  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T = any> = (this: Control, key: string, thisArg: Control) =>
    | Control.Descriptor<T>
    | Control.Getter<T>
    | void;
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
    Object.defineProperty(this, "is", { value: this });

    ID.set(this, `${this.constructor}-${id ? String(id) : uid()}`);
    new Control(this);
  }

  /** Pull current values from state. Flattens all models and exotic values amongst properties. */
  get(): Model.Export<this>;

  /** Run a function which will run automatically when accessed values change. */
  get(effect: Model.Effect<this>): Callback;

  get(arg1?: Model.Effect<this>){
    if(arg1)
      return effect(this, arg1);

    const cache = new WeakMap<Model, any>();

    function get(value: any){
      if(value instanceof Model){
        if(cache.has(value))
          return cache.get(value);

        const { state } = control(value);
        cache.set(value, value = {});

        for(const key in state)
          value[key] = get(state[key]);
      }

      return value;
    }

    return get(this);
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
   * @returns a function to remove listener
  */
  set(callback: Model.Event): Callback;

  /**
   * Push an update without changing the value of associated property.
   * 
   * This is useful where a property value internally has changed, but the object remains the same.
   * For example: an array which has pushed a new value, or change to nested properties.
   */
  set(key: string): void;

  /**
   * Update a property programatically within state. 
   * 
   * @param key - property to update
   * @param value - value to update property with (if the same as current, no update will occur)
   * @param silent - if true, will not notify listeners of an update
   */
  // set<K extends Model.Any<this>>(key: K, value?: Model.ValueOf<this, K>, silent?: boolean): void;
  set<K extends string>(key: K, value?: Model.ValueOf<this, K>, silent?: boolean): void;

  set(arg1?: Model.Event | number | string, arg2?: Predicate | unknown, arg3?: boolean){
    const self = control(this);

    if(typeof arg1 == "function")
      return self.addListener(key => {
        if(typeof key == "string")
          return arg1(key)
      })

    if(typeof arg1 == "string")
      return 1 in arguments ? self.set(arg1, arg2, arg3) : self.set(arg1);

    return new Promise<any>((resolve, reject) => {
      if(typeof arg1 != "number" && Object.isFrozen(self.frame)){
        resolve(false);
        return;
      }
  
      const callback = () => resolve(self.frame);
      const remove = self.addListener((key) => {
        if(key === true || typeof arg2 == "function" && typeof key == "string" && arg2(key) !== true)
          return;
  
        if(timeout)
          clearTimeout(timeout);
  
        remove();
  
        return callback;
      });
  
      const timeout = typeof arg1 == "number" && setTimeout(() => {
        remove();
        reject(arg1);
      }, arg1);
    });
  }

  /** Mark this instance for garbage collection. */
  null(){
    control(this, false);
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
    control(instance, true);
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
    return ID.get(this);
  }
});

Object.defineProperty(Model, "toString", {
  value(){
    return this.name;
  }
});

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  Model,
  PARENT,
  uid
}