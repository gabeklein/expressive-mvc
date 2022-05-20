import { apply } from './apply';
import { issues } from '../issues';
import { pendingFactory, pendingValue } from '../suspense';
import { createValueEffect } from '../util';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  BadFactory: () =>
    `Set instruction can only accept a factory or undefined.`,

  FactoryFailed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`
})

declare namespace set {
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
function set <T = any>(): T;

 /**
  * Set property with starting value `undefined`.
  * 
  * If required and accessed while still empty, React Suspense will be thrown.
  * Property will reject any assignment of undefined.
  * 
  * @param value - Starting value of host property (undefined).
  * @param required - Property will suspend callee if undefined at time of access.
  */
function set <T> (value: undefined, required: false): T | undefined;
function set <T> (value: undefined, required?: boolean): T;
 
function set <T> (value: undefined, onUpdate: set.Callback<T>): T | undefined;
function set <T, S> (value: undefined, onUpdate: set.Callback<T, S>): T | undefined;
 
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
function set <T>(factory: set.Factory<Promise<T>>, required: false): T | undefined;
function set <T, S>(factory: set.Factory<Promise<T>, S>, required: false): T | undefined;
 
function set <T>(factory: set.Factory<Promise<T>>, required?: boolean): T;
function set <T, S>(factory: set.Factory<Promise<T>, S>, required?: boolean): T;
 
function set <T> (value: set.Factory<Promise<T>>, onUpdate: set.Callback<T>): T;
function set <T, S> (value: set.Factory<Promise<T>, S>, onUpdate: set.Callback<T, S>): T;
 
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
function set <T>(factory: set.Factory<T>, required: false): T | undefined;
function set <T, S>(factory: set.Factory<T, S>, required: false): T | undefined;
 
function set <T>(factory: set.Factory<T>, required?: boolean): T;
function set <T, S>(factory: set.Factory<T, S>, required?: boolean): T;
 
function set <T> (value: set.Factory<T>, onUpdate: set.Callback<T>): T;
function set <T, S> (value: set.Factory<T, S>, onUpdate: set.Callback<T, S>): T;

function set(
  factory?: (key: string, subject: unknown) => any,
  argument?: set.Callback<any> | boolean): any {  

  return apply(
    function set(key){
      let set;
      let get: () => void;

      const required =
        argument === true || argument === undefined;

      if(factory === undefined)
        get = () => pendingValue(this, key);

      else if(typeof factory !== "function")
        throw Oops.BadFactory();

      else {
        get = pendingFactory.call(this, key, factory);

        if(required)
          try {
            get();
          }
          catch(err){
            if(err instanceof Promise)
              void 0;
            else {
              Oops.FactoryFailed(this.subject, key).warn();
              throw err;
            }
          }
      }

      if(typeof argument == "function")
        set = createValueEffect(argument);
      else
        set = (value: any) => {
          if(value === undefined && required)
            throw Oops.NonOptional(this.subject, key);
        }
  
      return { set, get }
    }
  )
}

export { set }