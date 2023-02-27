import { control, Control } from '../control';
import { createValueEffect } from '../effect';
import { defineProperty } from '../helper/object';
import { Model } from '../model';
import { add } from './add';

declare namespace ref {
  type Callback<T, S = any> = (this: S, argument: T) =>
    ((next: T) => void) | Promise<void> | void | boolean;

  interface Object<T = any> {
    (next: T): void;
    current: T | null;
  }

  /** Object with references to all managed values of `T`. */
  type Proxy<T extends Model> = {
    [P in Model.Key<T>]-?: Model.Ref<T[P]>
  };

  type CustomProxy<T extends Model, R> = {
    [P in Model.Key<T>]-?: R;
  }
}

/**
 * Creates an object with references to all managed values.
 * Each property is a function to set value in state when invoked.
 *
 * *Properties are simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param target - Source model from which to reference values.
 */
function ref <T extends Model> (target: T): ref.Proxy<T>;

/**
 * Creates an object with values based on managed values.
 * Each property will invoke mapper function on first access supply
 * the its return value going forward.
 *
 * @param target - Source model from which to reference values.
 * @param mapper - Function producing the placeholder value for any given property.
 */
function ref <O extends Model, R>
  (target: O, mapper: (key: Model.Key<O>) => R): ref.CustomProxy<O, R>;

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

function ref<T>(
  arg?: ref.Callback<T> | Model,
  mapper?: (key: string) => any){

  return add(
    function ref(key){
      let value: ref.Object | ref.Proxy<any> = {};

      this.state.set(key, undefined);

      if(typeof arg != "object")
        value = createRef(this, key, arg);
      else
        control(arg).state.forEach((_val, key) => {
          defineProperty(value, key,
            mapper ? {
              configurable: true,
              get(){
                const out = mapper(key);
                defineProperty(value, key, { value: out });
                return out;
              }
            } : {
              value: createRef(this, key)
            })
        })

      defineProperty(this.subject, key, { value });
    }
  )
}

export { ref }

function createRef(
  src: Control,
  key: string,
  cb?: ref.Callback<any>){

  const refObjectFunction =
    src.ref(key, cb && createValueEffect(cb));

  defineProperty(refObjectFunction, "current", {
    set: refObjectFunction,
    get: () => src.state.get(key)
  })

  return refObjectFunction as ref.Object;
}