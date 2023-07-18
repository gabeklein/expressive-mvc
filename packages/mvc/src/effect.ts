import { control, watch } from './control';
import { issues } from './helper/issues';
import { Model } from './model';
import { mayRetry } from './suspense';

import type { Callback } from '../types';

export const Oops = issues({
  BadCallback: () =>
    `Callback for effect-callback may only return a function.`
})

export function createEffect<T extends Model>(
  source: T, callback: Model.Effect<T>){

  return control(source, self => {
    let { subject } = self;
    let unSet: Callback | Promise<void> | void;
    let busy = false;

    function invoke(){
      if(busy)
        return;

      const output = mayRetry(() => {
        if(typeof unSet == "function")
          unSet();
    
        unSet = callback.call(subject, subject);
    
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

    subject = watch(subject, () => refresh);
    self.addListener(key => (
      key === null || refresh === null ? refresh : undefined
    ));

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}

export type AssignCallback<T> =
  (this: any, argument: T) =>
    ((next: T) => void) | Promise<any> | void | boolean;

export function createValueEffect<T = any>(
  callback: AssignCallback<T>,
  ignoreNull?: boolean){

  let unSet: ((next: T) => void) | undefined;

  return function(this: any, value: any){
    if(typeof unSet == "function")
      unSet = void unSet(value);

    if(value === null && ignoreNull)
      return;

    const out = callback.call(this, value);

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