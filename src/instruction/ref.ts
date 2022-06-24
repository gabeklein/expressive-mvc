import { createRef } from '../controller';
import { Model } from '../model';
import { createValueEffect, defineProperty } from '../util';
import { apply } from './apply';

declare namespace ref {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<void> | void | boolean;

  interface Object<T = any> {
    (next: T): void;
    current: T | null;
  }

  /** Object with references to all managed values of `T`. */
  type Proxy<T extends Model> = { [P in Model.Field<T>]: Model.Ref<T[P]> };
}

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 */
function ref <T = HTMLElement> (callback?: ref.Callback<T>): ref.Object<T>;
function ref <T, S> (callback?: ref.Callback<T, S>): ref.Object<T>;

function ref<T>(callback?: ref.Callback<T>){
  return apply(
    function ref(key){
      const value = createRef(this, key,
        callback && createValueEffect(callback)  
      );
    
      defineProperty(value, "current", {
        set: value,
        get: () => this.state.get(key)
      })

      return {
        value,
        explicit: true
      };
    }
  )
}

export { ref }