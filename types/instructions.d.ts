import Model from '.';
import { Async, Class, InstanceOf } from './types';

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 **/
export function apply <T = any> (instruction: Model.Instruction<T>, name?: string): T;

/**
 * Create a placeholder for specified Model type.
 */
export function use <T extends Model> (): T | undefined;

/**
 * Create a new child instance of model.
 */
export function use <T extends Class> (Type: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T>;

/**
 * Create a new child-instance from factory function.
 */
export function use <T extends Model> (from: () => T, callback?: (i: T) => void): T;

/**
 * Create child-instance relationship with provided model.
 *
 * Note: If `peer` is not already initialized before parent is
 * (created with `new` as opposed to create method), that model will
 * attach this via `parent()` instruction. It will not, if
 * already active.
 */
export function use <T extends Model> (peer: T, callback?: (i: T) => void): T;

/**
 * Generate a child controller from specified object. Object's values are be trackable, as would be for a full-model.
 *
 * Note: Child will *not* be same object as one provided.
 */
export function use <T extends {}> (object: T): T;

export namespace child {
  type Instruction<T> = (this: Model.Controller, key: string) => {
    get: () => T | undefined,
    set?: (value: T | undefined) => void
  }
}

/**
 * Generic instruction used by `use()` and `tap()` for recursive subscription.
 *
 * @param from - Instruction body is run upon parent create. Return function to fetch current value of field.
 */
export function child <T extends Model> (from: child.Instruction<T>): T;
 
/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Expects - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
export function parent <T extends typeof Model> (Expects: T, required: true): InstanceOf<T>;
export function parent <T extends typeof Model> (Expects: T, required?: false): InstanceOf<T> | undefined;

/**
 * Find and attach most applicable instance of Model via context.
 * 
 * Host controller will search element-hierarchy relative to where it spawned.
 * 
 * @param Type - Type of model to find from context
 * @param callback -
 *  - Invoked after context is scanned, is passed result - either found or undefined.
 *  - If argument is inadequate, but required, your implemention should simply throw.
 *  - If inadequate and not required, conditionally return false.
 */
export function tap <T extends typeof Model> (Type: T, callback?: (instance?: InstanceOf<T>) => void | true): InstanceOf<T>;
export function tap <T extends typeof Model> (Type: T, callback?: (instance?: InstanceOf<T>) => void | false): InstanceOf<T> | undefined;
 
/**
 * Find and attach most applicable instance of Model via context.
 *
 * Expects a `<Provider>` of target controller to exist. 
 * Host controller will search element-hierarchy relative to where it spawned.
 *
 * @param Type - Type of controller to attach to property. 
 * @param required - Throw if instance of Type cannot be found.
 */
export function tap <T extends Class> (Type: T, required?: boolean): InstanceOf<T>;

export namespace on {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;
}

/**
 * Cause property to synchronously run effect upon update.
 * 
 * Callback may return an effect callback, Promise (ignored), or a boolean.
 * 
 * If a boolean is returned explicitly, new value will be dropped. Useful to override.
 * 
 * - `false` will prevent update.
 * - `true` will emit update (unchanged).
 *
 * @param initialValue - Beginning value of host property.
 * @param onUpdate - Effect-callback fired upon set of host property.
 * 
 * @deprecated will be removed in favor of `set`
 */
export function on <T> (initialValue: undefined, onUpdate: on.Callback<T>): T | undefined;
export function on <T> (initialValue: T, onUpdate: on.Callback<T>): T;
export function on <T, S> (initialValue: undefined, onUpdate: on.Callback<T, S>): T | undefined;
export function on <T, S> (initialValue: T, onUpdate: on.Callback<T, S>): T;

/** Object with references to all managed values of `T`. */
export type Refs <T extends Model> = { [P in Model.Fields<T>]: Model.Ref<T[P]> };

export namespace ref {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;
}

/**
 * Creates an object with references to all managed values.
 * Each property will set value in state when invoked.
 *
 * *Properties are simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param target - Source model from which to reference values.
 */
export function ref <T extends Model> (target: T): Refs<T>;

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
export function ref <T = HTMLElement> (callback?: ref.Callback<T>): Model.Ref<T>;
export function ref <T, S> (callback?: ref.Callback<T, S>): Model.Ref<T>;

/**
 * Sets an exotic method with managed ready-state. Property accepts an async function.
 *
 * When an act-method is invoked, its `active` property to true for duration of call.
 * This is emitted as an update to property, both when called and after returns (or throws).
 *
 * **Note:** Subsequent calls will immediately throw if one is still pending.
 *
 * @param action - Action to fire when resulting property is invoked.
 */
export function act (action: Async): typeof action & { active: boolean };
export function act <S> (action: Async<S>): typeof action & { active: boolean };

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
export function from <R> (compute: (property: string) => <T>(this: T, state: T) => R | void, suspense: true): R;
export function from <R, T> (compute: (property: string) => (this: T, state: T) => R | void, suspense: true): R;
export function from <R> (compute: (property: string) => <T>(this: T, state: T) => R, suspense?: boolean): R;
export function from <R, T> (compute: (property: string) => (this: T, state: T) => R, suspense?: boolean): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source Model to find and subscribe to, for input.
 * 
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value.
 * Will update automatically as input values change.
 *
 * @param suspense - Compute function will suspend 
 */
export function from <T extends Class, R> (source: T, compute: (this: InstanceOf<T>, on: InstanceOf<T>) => R | void, suspense: true): R;
export function from <T extends Class, R> (source: T, compute: (this: InstanceOf<T>, on: InstanceOf<T>) => R, suspense?: boolean): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * 
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value.
 * Will update automatically as input values change.
 */
export function from <R, T> (source: T, compute: (this: T, on: T) => R): R;
 
/**
 * Flag property as not to be tracked. Useful if changes often with no real-time impact.
 *
 * @param value - starting value of property.
 * 
 * @deprecated will be removed in major version 1.0
 */
export function lazy <T> (value?: T): T;

/**
 * Pending value. Will suspend unless value is already defined,
 * suspense resolves when a value is then aquired.
 * 
 * @deprecated will be removed in favor of `set`
 */
export function pending <T = boolean> (): T;

/**
 * Suspend during the execution of given function to obtain value.
 * 
 * @param waitFor - Async function to suspend for.
 * 
 * @deprecated will be removed in favor of `set`
 */
export function pending (waitFor: () => Promise<void>): undefined;
export function pending <T> (waitFor: (this: T) => Promise<void>): undefined;
export function pending <R> (waitFor: () => Promise<R>): R;
export function pending <R, T> (waitFor: (this: T) => Promise<R>): R;

/**
 * Suspend for a computed value, returned by syncronous function.
 *
 * If accessed while computing to undefined, will throw a promise. Function is subscribed
 * and will re-evaluate anytime used properties change. Once function returns any value,
 * outstanding promises resolve and are not thrown on subsequent access of this property.
 * 
 * Similar to `from`, compute function will only run when inputs change and not upon access.
 *
 * This behavior is recursive. If return value _becomes_ undefined, property
 * access will throw Promises again, awaiting its next value.
 *
 * @param source - Source object, from which computed value will be a subscriber.
 *
 * @param compute - Compute function returns output value. Bound to a subscriber of source.
 * Will re-run automatically as input values change.
 */
export function pending <R, T> (source: T, compute: (this: T, on: T) => R): R; // ✅

export namespace set {
  type Factory<T, S = unknown> = (this: S, key: string, subject: S) => T;

  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;
}

/**
 * Set property with a placeholder.
 * 
 * Property cannot be accessed until it is defined. If accessed while undefined, a hybrid
 * `Promise`/`Error` (ala: [Suspense](https://reactjs.org/docs/concurrent-mode-suspense.html)) will be thrown.
 */
 export function set <T = any>(): T;

 /**
  * Set property with starting value `undefined`.
  * 
  * If required and accessed while still empty, React Suspense will be thrown.
  * Property will reject any assignment of undefined.
  * 
  * @param value - Starting value of host property (undefined).
  * @param required - Property will suspend callee if undefined at time of access.
  */
 export function set <T> (value: undefined, required: false): T | undefined;
 export function set <T> (value: undefined, required?: boolean): T;
 
 export function set <T> (value: undefined, onUpdate: set.Callback<T>): T | undefined;
 export function set <T, S> (value: undefined, onUpdate: set.Callback<T, S>): T | undefined;
 
 /**
  * Set property with an async function.
  * 
  * Property cannot be accessed until factory resolves, yeilding a result.
  * If accessed while processing, React Suspense will be thrown.
  * 
  * - `required: true` (default) -
  *      Run factory immediately upon creation of model instance.
  * - `required: false` -
  *      Run factory only if/when accessed.
  *      Value will always throw suspense at least once - use with caution.
  * 
  * @param factory - Callback run to derrive property value.
  * @param required - (default: true) Run factory immediately on creation, otherwise on access.
  */
 export function set <T>(factory: set.Factory<Promise<T>>, required: false): T | undefined;
 export function set <T, S>(factory: set.Factory<Promise<T>, S>, required: false): T | undefined;
 
 export function set <T>(factory: set.Factory<Promise<T>>, required?: boolean): T;
 export function set <T, S>(factory: set.Factory<Promise<T>, S>, required?: boolean): T;
 
 export function set <T> (value: set.Factory<Promise<T>>, onUpdate: set.Callback<T>): T;
 export function set <T, S> (value: set.Factory<Promise<T>, S>, onUpdate: set.Callback<T, S>): T;
 
 /**
  * Set property with a factory function.
  * 
  * - `required: true` (default) -
  *      Run factory immediately upon creation of model instance.
  * - `required: false` -
  *      Run factory only if/when accessed.
  *      Value will always throw suspense at least once - use with caution.
  * 
  * @param factory - Callback run to derrive property value.
  * @param required - (default: true) Run factory immediately on creation, otherwise on access.
  */
 export function set <T>(factory: set.Factory<T>, required: false): T | undefined;
 export function set <T, S>(factory: set.Factory<T, S>, required: false): T | undefined;
 
 export function set <T>(factory: set.Factory<T>, required?: boolean): T;
 export function set <T, S>(factory: set.Factory<T, S>, required?: boolean): T;
 
 export function set <T> (value: set.Factory<T>, onUpdate: set.Callback<T>): T;
 export function set <T, S> (value: set.Factory<T, S>, onUpdate: set.Callback<T, S>): T;
 