declare global {
  type Callback = () => void;

  namespace jest {
    interface Matchers<R> {
      /** Assert model does have one or more updates pending. */
      toUpdate(): Promise<R>;

      /** Assert model did update with keys specified. */
      toHaveUpdated<R>(...keys: string[]): Promise<R>; 
    }
  }
}

type Callback = () => void;
type InstanceOf<T> = T extends { prototype: infer U } ? U : never;
type Class = new (...args: any[]) => any;
type Predicate = (key: string) => boolean | void;

type Async<T = any, Y extends any[] = any> = {
  (...args: Y): Promise<T>;
  active: boolean;
};

/**
* Sets an exotic method with managed ready-state. Property accepts an async function.
*
* When a run-method is invoked, its `active` property to true for duration of call.
* This is emitted as an update to property, both when called and after returns (or throws).
*
* **Note:** Subsequent calls will immediately throw if one is still pending.
*
* @param action - Action to fire when resulting property is invoked.
*/
declare function run<T, Y extends any[]>(action: (...args: Y) => T | Promise<T>): Async<T, Y>;

declare namespace Model {
  /** Any typeof Model, using class constructor as the reference. */
  type Type<T extends Model = Model> = abstract new (...args: any[]) => T;
  /** A typeof Model, specifically one which can be created without any arguments. */
  type New<T extends Model = Model> = (new () => T) & typeof Model;
  /** Subset of `keyof T` which are not methods or defined by base Model U. **/
  type Key<T> = Exclude<keyof T, keyof Model> & string;
  /** Actual value stored in state. */
  type Value<R> = R extends Ref<infer T> ? T : R extends Model ? Export<R> : R;
  /** Object comperable to data found in T. */
  type Values<T> = {
      [P in Key<T>]?: Value<T[P]>;
  };
  /**
   * Values from current state of given controller.
   * Differs from `Values` as values here will drill into "real" values held by exotics like ref.
   */
  type Export<T> = {
      [P in keyof T]: Value<T[P]>;
  };
  /** Exotic value, where actual value is contained within. */
  type Ref<T = any> = {
      (next: T): void;
      current: T | null;
  };
  /** A callback function which is subscribed to parent and updates when values change. */
  type Effect<T> = (this: T, argument: T) => Callback | Promise<void> | void;
  type Event = (key: string) => Callback | void;
}

declare class Model {
  is: this;
  constructor(id?: string | number);
  /** Pull current values from state. Flattens all models and exotic values amongst properties. */
  get(): Model.Export<this>;
  /** Run a function which will run automatically when accessed values change. */
  get(effect: Model.Effect<this>): Callback;
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
  /** Mark this instance for garbage collection. */
  null(): void;
  /**
   * Creates a new instance of this controller.
   *
   * Beyond `new this(...)`, method will activate managed-state.
   *
   * @param args - arguments sent to constructor
   */
  static new<T extends Class>(this: T, ...args: ConstructorParameters<T>): InstanceOf<T>;
  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends Model.Type>(this: T, maybe: any): maybe is T;
}

declare namespace Context {
  type Inputs = {
      [key: string | number]: Model | Model.New;
  };
}

declare class Context {
  key: string;
  private table;
  private layer;
  private has;
  get<T extends Model>(Type: Model.Type<T>): T | undefined;
  include(inputs: Context.Inputs): Map<Model, boolean>;
  add<T extends Model>(input: T | Model.New<T>, implicit?: boolean): T;
  push(): this;
  pop(): void;
}

declare namespace get {
  type Function<T, S = any> = (this: S, on: S) => T;
  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;
  type Source<T extends Model = Model> = (resolve: (x: T) => void) => void;
}

/**
* Fetches and assigns the controller which spawned this host.
* When parent assigns an instance via `use()` directive, it
* will be made available to child upon this request.
*
* @param Type - Type of controller compatible with this class.
* @param required - If true, will throw if Model is created without a parent.
*/
declare function get<T extends Model>(Type: Model.Type<T>, required?: true): T;

/**
* Fetches and assigns the controller which spawned this host.
* When parent assigns an instance via `use()` directive, it
* will be made available to child upon this request.
*
* @param Type - Type of controller compatible with this class.
* @param required - If false, property may be undefined. Otherwise will throw suspense.
*/
declare function get<T extends Model>(Type: Model.Type<T>, required: boolean): T | undefined;

/**
* Implement a computed value from a foreign model. Output will be generated by provided function,
* where the foreign model will be passed to that function.
*
* @param source - Type of Model to fetch for computation.
* @param compute - Compute function. Will update automatically as input values change.
*/
declare function get<R, T extends Model>(Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
* Implement a computed value; output will be generated by provided function.
*
* @param source - Source model from which computed value will be a subscriber.
* @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
*/
declare function get<R, T extends Model>(source: T, compute: (this: T, on: T) => R): R;

/**
* Implement a computed value; output is returned by function from provided factory.
*
* @param compute - Factory function to generate a getter to subscribe dependancies.
*/
declare function get<R, T>(compute: (property: string, on: T) => (this: T, state: T) => R): R;

declare namespace ref {
  type Callback<T> = (argument: T) => ((next: T | null) => void) | Promise<void> | void | boolean;
  interface Object<T = any> {
      (next: T | null): void;
      current: T | null;
  }
  /** Object with references to all managed values of `T`. */
  type Proxy<T extends Model> = {
      [P in Model.Key<T>]-?: Model.Ref<T[P]>;
  };
  type CustomProxy<T extends Model, R> = {
      [P in Model.Key<T>]-?: R;
  };
}
/**
* Creates an object with references to all managed values.
* Each property is a function to set value in state when invoked.
*
* *Properties are simultaneously a ref-function and ref-object, use as needed.*
*
* @param target - Source model from which to reference values.
*/
declare function ref<T extends Model>(target: T): ref.Proxy<T>;

/**
* Creates an object with values based on managed values.
* Each property will invoke mapper function on first access supply
* the its return value going forward.
*
* @param target - Source model from which to reference values.
* @param mapper - Function producing the placeholder value for any given property.
*/
declare function ref<O extends Model, R>(target: O, mapper: (key: Model.Key<O>) => R): ref.CustomProxy<O, R>;

/**
* Creates a ref-compatible property.
* Will persist value, and updates to this are made part of controller event-stream.
*
* *Output is simultaneously a ref-function and ref-object, use as needed.*
*
* @param callback - Optional callback to synchronously fire when reference is first set or does update.
*/
declare function ref<T = HTMLElement>(callback?: ref.Callback<T>): ref.Object<T>;

/**
* Creates a ref-compatible property.
* Will persist value, and updates to this are made part of controller event-stream.
*
* *Output is simultaneously a ref-function and ref-object, use as needed.*
*
* @param callback - Optional callback to synchronously fire when reference is first set or does update.
* @param ignoreNull - Default `true`. If `false`, will still callback with `null`.
*/
declare function ref<T = HTMLElement>(callback: ref.Callback<T | null>, ignoreNull: boolean): ref.Object<T>;

declare namespace set {
  type Callback<T, S = any> = (this: S, next: T, previous: T) => ((next: T) => void) | Promise<any> | void | boolean;
  type Factory<T, S = any> = (this: S, key: string, thisArg: S) => Promise<T> | T;
}

/**
* Set property with a placeholder.
*
* Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
* `Promise`/`Error` (ala: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
*/
declare function set<T = any>(): T;

/**
* Set property with a factory function.
*
* Run factory only if/when accessed. Value will be undefined until
* factory resolves, which will also dispatch an update for the property.
*/
declare function set<T>(factory: set.Factory<T> | Promise<T>, required: false): T | undefined;

/**
* Set property with a factory function.
*
* If async, property cannot be accessed until resolves, yeilding a result.
* If accessed while still processing, React Suspense will be thrown.
*
* @param factory - Callback run to derrive property value.
* @param required - If true run factory immediately on creation, otherwise on access.
*/
declare function set<T>(factory: set.Factory<T> | Promise<T>, required?: boolean): T;

/**
* Set a property with empty placeholder and update callback.
*
* @param value - Starting value for property. If undefined, suspense will be thrown on access, until value is set and accepted by callback.
* @param onUpdate - Callback run when property is set. If returns false, update is not accepted and property will keep previous value.
*/
declare function set<T>(value: T | undefined, onUpdate: set.Callback<T>): T;

declare namespace use {
  type Object<T extends {}> = T;
}

/** Create a placeholder for specified Model type. */
declare function use<T extends Model>(): T | undefined;

/** Create a new child instance of model. */
declare function use<T extends Model>(Type: Model.New<T>, ready?: (i: T) => void): T;

/**
* Use existing model as a child of model assigned to.
*
* Note: If `peer` is not already initialized before parent is
* (created with `new` as opposed to create method), that model will
* attach this via `parent()` instruction. It will not, however, if
* already active.
**/
declare function use<T extends Model>(model: T, ready?: (i: T) => void): T;

/** Create a managed object with observable entries. */
declare function use<T extends {}, O = use.Object<T>>(data: T, ready?: (object: O) => void): O;

declare namespace Control {
  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T> = (this: Control, key: string, thisArg: Control) => PropertyDescriptor<T> | Getter<T> | void;
  type Getter<T> = (source: Model) => T;
  type Setter<T> = (value: T, previous: T) => boolean | void;
  type PropertyDescriptor<T = any> = {
      get?: Getter<T>;
      set?: Setter<T> | false;
      enumerable?: boolean;
      value?: T;
  };

  type Callback = (control: Control) => void;

  /**
   * Callback for Controller.for() static method.
   * Returned callback is forwarded.
   */
  type OnReady<T extends {}> = (control: Control<T>) => (() => void) | void;
  type OnUpdate<T extends {} = any> = (key: Model.Key<T> | null | undefined, source: T) => (() => void) | null | void;
  type OnChange = (this: {}, next: unknown, previous: unknown) => boolean | void;
}

declare class Control<T extends {} = any> {
  static watch: typeof watch;
  static for: typeof control;
  static add: typeof add;
  static on(event: "ready", callback: Control.Callback): Callback;
  static on(event: "update" | "didUpdate", callback: Callback): Callback;

  id: string;
  subject: T;
  state: { [property: string]: unknown };
  frame: { [property: string]: unknown };

  listeners: Map<Control.OnUpdate, Set<string> | undefined>;

  constructor(subject: T, id?: string | number | false);
  
  watch(key: string, output: Control.PropertyDescriptor<any>): void;
  update(key: string, value?: unknown): void;
  fetch(key: string, required?: boolean): () => unknown;
  addListener<T extends Model>(fn: Control.OnUpdate<T>): () => boolean;
  clear(): void;
}

declare function control<T extends Model>(subject: T, ready: Control.OnReady<T>): Callback;
declare function control<T extends Model>(subject: T, ready?: boolean): Control<T>;

declare function watch<T extends {}>(value: T, argument: Control.OnUpdate): T;

declare function add<T = any>(instruction: Control.Instruction<T>): T;

export {
  Context,
  Control,
  Model,
  Model as default,
  get,
  ref,
  run,
  set,
  use
};