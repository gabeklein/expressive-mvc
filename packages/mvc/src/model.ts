import { Control, control, watch } from './control';

const ID = new WeakMap<Model, string>();
const INSTRUCT = new Map<symbol, Model.Instruction>();
const PARENT = new WeakMap<Model, Model>();

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
type Class = new (...args: any[]) => any;
type Predicate = (key: string) => boolean | void;

declare namespace Model {
  /** Any type of Model, using own class constructor as its identifier. */
  type Type<T extends Model = Model> = abstract new (...args: any[]) => T

  /** A type of Model which may be created without constructor arguments. */
  type New<T extends Model = Model> = (new () => T) & typeof Model;

  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Key<T> = Exclude<keyof T, keyof Model> & string;

  /** Actual value stored in state. */
  type Value<R> =
    R extends Ref<infer T> ? T :
    R extends Model ? Export<R> :
    R;

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
  type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | void;

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

class Model {
  /**
   * Loopback to instance of this model. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is!: this;

  constructor(id?: string | number){
    Object.defineProperty(this, "is", { value: this });

    ID.set(this, `${this.constructor}-${id ? String(id) : uid()}`);

    const control = new Control(this);
    const done = control.addListener(() => {
      for(const key in this){
        const { value } = Object.getOwnPropertyDescriptor(this, key)!;
        const instruction = INSTRUCT.get(value);
        let desc: Control.Descriptor | void = { value };
  
        if(instruction){
          INSTRUCT.delete(value);
          delete this[key];
  
          const output = instruction.call(control, key, control);
          desc = typeof output == "function" ? { get: output } : output;
        }
  
        if(desc)
          control.watch(key, desc);
      }

      done();
    });
  }

  /** Pull current values from state. Flattens all models and exotic values amongst properties. */
  get(): Model.Export<this>;

  /** Run a function which will run automatically when accessed values change. */
  get(effect: Model.Effect<this>): Callback;

  get(arg1?: Model.Effect<this>){
    return typeof arg1 == "function"
      ? effect(this, arg1)
      : extract(this);
  }

  /** Assert update is in progress. Returns a promise which resolves updated keys. */
  set(): Promise<Model.Values<this> | false>;

  /**
   * Expect an update to state within timeout.
   * 
   * @param timeout - milliseconds to wait for update
   * @param predicate - optional function to filter updates. If returns true, update is accepted.
   * 
   * @returns a promise which resolves full update.
   */
  set(timeout: number, predicate?: Predicate): Promise<Model.Values<this>>;

  /**
   * Call a function when an update to state has occured.
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

  set(arg1?: Model.Event | number, arg2?: Predicate){
    return typeof arg1 == "function"
      ? control(this).addListener(key => {
        if(typeof key == "string")
          return arg1(key)
      })
      : nextUpdate(this, arg1, arg2);
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
  static new <T extends Class> (
    this: T, ...args: ConstructorParameters<T>
  ): InstanceOf<T> {
    const instance = new this(...args);
    control(instance, true);
    return instance;
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

function add<T = any>(instruction: Model.Instruction<T>){
  const placeholder = Symbol("instruction");
  INSTRUCT.set(placeholder, instruction);
  return placeholder as unknown as T;
}

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  add,
  Model,
  PARENT,
  uid
}

function extract(target: Model){
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

  return get(target);
}

function nextUpdate(
  target: Model,
  arg1?: number,
  arg2?: (key: string) => boolean | void){

  return new Promise<any>((resolve, reject) => {
    const self = control(target);

    if(typeof arg1 != "number" && Object.isFrozen(self.frame)){
      resolve(false);
      return;
    }

    const callback = () => resolve(self.frame);

    const remove = self.addListener((key) => {
      if(key === true || arg2 && typeof key == "string" && arg2(key) !== true)
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

function effect<T extends Model>(
  target: T, callback: Model.Effect<T>){

  const self = control(target);
  let refresh: (() => void) | null | undefined;
  let unSet: Callback | undefined;

  function invoke(){
    if(unSet)
      unSet();

    try {
      const out = callback.call(target, target);
      unSet = typeof out == "function" ? out : undefined;
    }
    catch(err){
      if(err instanceof Promise){
        refresh = undefined;
        err.then(ready);
      }
      else 
        console.error(err);
    }
  }

  function ready() {
    refresh = invoke;
    invoke();
  }

  target = watch(self.subject, () => refresh);

  if(self.state)
    ready();

  self.addListener(key => {
    if(key === true)
      return ready();

    if(!refresh)
      return refresh;

    if(key === null && unSet)
      unSet();
  });

  return () => {
    refresh = null;
  };
}