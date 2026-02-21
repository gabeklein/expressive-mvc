import { Observable } from './observable';

/** Any type of State, using own class constructor as its identifier. */
type Extends<T extends State = State> = (abstract new (...args: any[]) => T) &
  typeof State;

/** A State constructor which may be instanciated. */
type Type<T extends State = State> = (new (...args: State.Args<T>) => T) &
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
type Export<R> = R extends { get(): infer T } ? T : R;

/**
 * Values from current state of given state.
 * Differs from `Values` as values here will drill
 * into "real" values held by exotics like ref.Object.
 */
type Values<T> = { [P in Field<T>]: Export<T[P]> };

/** Object comperable to data found in T. */
type Partial<T> = { [P in Field<T>]?: Export<T[P]> };

/** Value for a property managed by a state. */
type Value<T extends State, K extends State.Event<T>> = K extends keyof T
  ? Export<T[K]>
  : unknown;

type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

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

type Pending<T extends State> = readonly Event<T>[] &
  PromiseLike<readonly Event<T>[]>;

declare namespace State {
  export {
    Extends,
    Type,
    Args,
    Init,
    Assign,
    Field,
    Event,
    Signal,
    Export,
    Values,
    Partial,
    Value,
    Setter,
    OnEvent,
    OnUpdate,
    Ref,
    Effect,
    EffectCallback,
    Pending
  };
}

interface State {
  /**
   * Loopback to instance of this state. This is useful when in a subscribed context,
   * to keep write access to `this` after a destructure. You can use it to read variables silently as well.
   **/
  is: this;
}

declare abstract class State {
  constructor(...args: State.Args);

  [Observable](callback: Observable.Callback, required?: boolean): this;

  /**
   * Optional lifecycle hook called during State initialization.
   * Can return a cleanup function to run when state is destroyed.
   */
  protected new?(): void | (() => void);

  /**
   * Pull current values from state. Flattens all states and exotic values recursively.
   *
   * @returns Object with all values from this state.
   **/
  get(): State.Values<this>;

  /**
   * Run a function which will run automatically when accessed values change.
   *
   * @param effect Function to run, and again whenever accessed values change.
   *               If effect returns a function, it will be called when a change occurs (syncronously),
   *               effect is cancelled, or parent state is destroyed.
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
   * Check if state is expired.
   *
   * @param status - `null` to check if state is expired.
   * @returns `true` if state is expired, `false` otherwise.
   */
  get(status: null): boolean;

  /**
   * Callback when state is to be destroyed.
   *
   * @param callback - Function to call when state is destroyed.
   * @returns Function to cancel listener.
   */
  get(status: null, callback: () => void): () => void;

  /**
   * Get update in progress.
   *
   * @returns Promise which resolves object with updated values, `undefined` if there no update is pending.
   **/
  set(): State.Pending<this>;

  /**
   * Update mulitple properties at once. Merges argument with current state.
   * Properties which are not managed by this state will be ignored.
   *
   * @param assign - Object with properties to update.
   * @param silent - If an update does occur, listeners will not be refreshed automatically.
   * @returns Promise resolving an array of keys updated, `undefined` (immediately) if a noop.
   */
  set(assign?: State.Assign<this>, silent?: boolean): State.Pending<this>;

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
  set(key: State.Event<this>): State.Pending<this>;

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
   * @param init - If true, state will begin to manage the property if it is not already.
   * @returns Promise resolves an array of keys updated.
   */
  set(
    key: State.Event<this>,
    value: unknown,
    init?: boolean
  ): State.Pending<this>;

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

  /**
   * Iterate over managed properties in this instance of State.
   * Yeilds the key and current value for each property.
   */
  [Symbol.iterator](): Iterator<[string, unknown]>;

  /**
   * Create and activate a new instance of this state.
   *
   * **Important** - Unlike `new this(...)` - this method also activates state.
   *
   * @param args - arguments sent to constructor
   */
  static new<T extends State>(this: State.Type<T>, ...args: State.Args<T>): T;

  /**
   * Static equivalent of `x instanceof this`.
   * Determines if provided class is a subtype of this one.
   * If so, language server will make available all static
   * methods and properties of this class.
   */
  static is<T extends State.Extends>(this: T, maybe: unknown): maybe is T;

  /**
   * Register a callback to run when any instance of this State is updated.
   */
  static on<T extends State>(
    this: State.Extends<T>,
    event: State.OnEvent<T>
  ): () => any;
}

export {
  Extends,
  Type,
  Args,
  Init,
  Assign,
  Field,
  Event,
  Signal,
  Export,
  Values,
  Partial,
  Value,
  Setter,
  OnEvent,
  OnUpdate,
  Ref,
  Effect,
  EffectCallback,
  Pending,
  State
};
