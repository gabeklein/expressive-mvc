import { add, Control } from '../control';
import { issues } from '../helper/issues';
import { define } from '../helper/object';
import { Model } from '../model';

export const Oops = issues({
  BadRefObject: () =>
    `ref instruction does not support object which is not 'this'`
})

declare namespace ref {
  type Callback<T> = (argument: T) =>
    ((next: T | null) => void) | Promise<void> | void | boolean;

  interface Object<T = any> {
    (next: T | null): void;
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

/**
 * Creates a ref-compatible property.
 * Will persist value, and updates to this are made part of controller event-stream.
 *
 * *Output is simultaneously a ref-function and ref-object, use as needed.*
 *
 * @param callback - Optional callback to synchronously fire when reference is first set or does update.
 * @param ignoreNull - Default `true`. If `false`, will still callback with `null`.
 */
function ref <T = HTMLElement> (callback: ref.Callback<T | null>, ignoreNull: boolean): ref.Object<T>;

function ref<T>(
  arg?: ref.Callback<T> | Model,
  arg2?: ((key: string) => any) | boolean){

  return add<T>((key, source) => {
    let value: ref.Object | ref.Proxy<any> = {};

    if(typeof arg != "object"){
      let unSet: ((next: T) => void) | undefined;

      value = createRef(source, key, arg &&
        function(this: any, value: any){
          if(unSet)
            unSet = void unSet(value);
      
          if(value !== null || arg2 === false){  
            const out = arg.call(this, value);
        
            if(typeof out == "function")
              unSet = out;
          }
        }
      );
    }
    else if(arg === source.subject)
      for(const key in source.state)
        define(value, key,
          typeof arg2 == "function" ? {
            configurable: true,
            get(){
              const out = arg2(key);
              define(value, key, { value: out });
              return out;
            }
          } : {
            value: createRef(source, key)
          }
        )
    else
      throw Oops.BadRefObject();

    source.update(key);
    define(source.subject, key, { value });
  })
}

export { ref }

function createRef(
  src: Control,
  key: string,
  cb?: (x: any) => boolean | void){

  const refObjectFunction = src.ref(key, cb);

  define(refObjectFunction, "current", {
    set: refObjectFunction,
    get: () => src.state[key]
  })

  return refObjectFunction as ref.Object;
}