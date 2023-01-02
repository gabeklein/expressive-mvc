import { createValueEffect } from '../util';
import { apply } from './apply';

declare namespace set {
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

function set <T> (onUpdate: set.Callback<T>): T;
function set <T, S> (onUpdate: set.Callback<T, S>): T;

function set <T> (value: undefined, onUpdate: set.Callback<T>): T;
function set <T, S> (value: undefined, onUpdate: set.Callback<T, S>): T;

function set <T> (value: T, onUpdate: set.Callback<T>): T;
function set <T, S> (value: T, onUpdate: set.Callback<T, S>): T;

function set(
  value?: any,
  argument?: set.Callback<any> | boolean): any {

  if(!(1 in arguments)){
    argument = value;
    value = undefined;
  }

  return apply(
    function set(key){
      if(value !== undefined)
        this.state.set(key, value);

      return {
        suspend: true,
        set: typeof argument == "function"
          ? createValueEffect(argument)
          : undefined
      }
    }
  )
}

export { set }