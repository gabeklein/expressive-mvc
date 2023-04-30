import { control, detect } from './control';
import { issues } from './helper/issues';
import { Model } from './model';
import { mayRetry } from './suspense';

import type { Callback } from '../types';

export const Oops = issues({
  BadCallback: () =>
    `Callback for effect-callback may only return a function.`
})

export function createEffect<T extends Model>(
  model: T, callback: Model.Effect<T>){

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

    let refresh: (() => void) | null;

    model = detect(model, () => refresh);
    self.followers.add(key => (
      key === null || refresh === null ? refresh : undefined
    ));

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