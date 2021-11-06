import Model from '.';
import { Async, Class, InstanceOf, InterceptCallback } from './types';

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 **/
export function set <T = any> (instruction: Model.Instruction<T>, name?: string): T;

/**
 * Creates a new child-instance of specified controller.
 *
 * @param Peer - Type of Model to create and apply to host property.
 * @param callback - Fired after controller is created and ready for use.
 */
export function use <T extends Class> (Peer: T, callback: (i?: InstanceOf<T>) => void): InstanceOf<T> | undefined;

/**
 * Creates a new child-instance of specified controller.
 *
 * @param Peer - Type of Model to create and apply to host property.
 * @param required - Property should be non-nullable, will throw if value is set to undefined.
 */
export function use <T extends Class> (Peer: T, required: false): InstanceOf<T> | undefined;
export function use <T extends Class> (Peer: T, required?: true): InstanceOf<T>;

/**
 * Creates a new child-instance of specified controller.
 *
 * @param factory - Generate model for use.
 * @param callback - Fired after controller is created and ready for use.
 */
export function use <T extends Model | undefined> (factory: () => T, callback?: (i: T) => void): T;

/**
 * Create a child-instance relationship with provided model.
 *
 * Note: If `peer` is not already initialized before parent is
 * (created with `new` as opposed to create method), that model will
 * attach this via `parent()` instruction. It will not howerver, if
 * already active.
 *
 * @param factory - Instance of model to attach.
 * @param callback - Fired after controller is attached.
 */
export function use <T extends Model> (peer: T, callback?: (i: T) => void): T;

/**
 * Create a placeholder for specified Model type.
 */
export function use <T extends Model> (): T | undefined;

/**
 * Generate a child controller from specified object. Object's values are be trackable, as would be for a full-model.
 *
 * Note: Child will *not* be same object as one provided.
 */
export function use <T extends {}> (object: T): T;

/**
 * Generic instruction used by `use()` and `tap()` for recursive subscription.
 *
 * @param from - Instruction body is run upon parent create. Return function to fetch current value of field.
 */
export function child <T extends Model> (from: (this: Model.Controller, key: string) => () => T | undefined): T;
 
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
 */
export function on <T = any> (initialValue: undefined, onUpdate: InterceptCallback<T>): T | undefined;
export function on <T = any> (initialValue: T, onUpdate: InterceptCallback<T>): T;

/**
 * Creates a ref-compatible property for use with components.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
export function ref <T = HTMLElement> (this: any, callback?: InterceptCallback<T>): Model.Ref<T>;

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
export function act <T extends Async> (action: T): T & { active: boolean };
 
/**
 * Implement a computed value; output will be generated by provided function.
 *
 * *Alternative to using native getters; works exactly the same!*
 *
 * @param fn - Factory function to generate value and subscribe dependancies.
 */
export function from <T, R> (fn: (this: T, on: T) => R): R;

/**
 * Memoized value. Computes and stores a value returned by provided factory. 
 * Equivalent to a getter, sans the automatic updates.
 *
 * @param compute - Factory for memoized value.
 * @param lazy - Wait until accessed to introduce value.
 */
export function memo <T> (compute: () => T, lazy?: boolean): T;
 
/**
 * Flag property as not to be tracked. Useful if changes often with no real-time impact.
 *
 * @param value - starting value of property.
 */
export function lazy <T> (value?: T): T;