import { Control, control, detect } from './control';
import { issues } from './helper/issues';
import { Model } from './model';
import { mayRetry } from './suspense';

import type { Callback } from '../types';

export const Oops = issues({
  BadCallback: () =>
    `Callback for effect-callback may only return a function.`
})

export function createEffect<T extends Model>(
  model: T,
  callback: Model.Effect<T>,
  keys: Model.Event<T>[]){

  return control(model, self => {
    let unSet: Callback | Promise<any> | void;
    let busy = false;

    function invoke(){
      if(busy)
        return;

      const output = mayRetry(() => {
        if(typeof unSet == "function")
          unSet();
    
        unSet = callback.call(model, model);
    
        if(unSet instanceof Promise)
          unSet = undefined;
    
        if(unSet && typeof unSet !== "function")
          throw Oops.BadCallback()
      })

      if(output instanceof Promise){
        output.finally(() => busy = false);
        busy = true;
      }
    }

    if(Array.isArray(keys)){
      invoke();

      const callback: Control.OnSync = key => {
        if(key === null){
          if(!keys.length)
            invoke();
        }
        else if(keys.includes(key))
          return invoke;
      };

      self.followers.add(callback);

      return () => self.followers.delete(callback);
    }

    let refresh: (() => void) | null;

    model = detect(model, () => refresh);

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}

export type AssignCallback<T> =
  (this: any, argument: T, thisArg: any) =>
    ((next: T) => void) | Promise<any> | void | boolean;

export function createValueEffect<T = any>(
  callback: AssignCallback<T>){

  let unSet: ((next: T) => void) | undefined;

  return function(this: any, value: any){
    if(typeof unSet == "function")
      unSet(value);

    const out = callback.call(this, value, this);

    if(typeof out == "boolean")
      return out;

    if(!out || out instanceof Promise)
      return;

    if(typeof out == "function")
      unSet = out;
    else
      throw Oops.BadCallback()
  }
}