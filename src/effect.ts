import { Control } from './control';
import { issues } from './helper/issues';
import { Callback } from './helper/types';
import { Model } from './model';
import { mayRetry } from './suspense';

export const Oops = issues({
  BadCallback: () =>
    `Callback for effect-callback may only return a function.`
})

export function createEffect<T extends Model>(
  model: T,
  callback: Model.Effect<T>,
  keys: Model.Event<T>[]){

  return Control.for(model, control => {
    let unSet: Callback | Promise<any> | void;
    let busy = false;

    function effect(this: any, value: any){
      if(typeof unSet == "function")
        unSet();
  
      unSet = callback.call(this, value);
  
      if(unSet instanceof Promise)
        unSet = undefined;
  
      if(unSet && typeof unSet !== "function")
        throw Oops.BadCallback()
    }

    function invoke(){
      if(busy)
        return;

      const output = mayRetry(() => {
        effect.call(model, model);
      })

      if(output instanceof Promise){
        output.finally(() => busy = false);
        busy = true;
      }
    }

    if(Array.isArray(keys)){
      invoke();

      return control.addListener(key => {
        if(key === null){
          if(!keys.length)
            invoke();
        }
        else if(keys.includes(key))
          return invoke;
      });
    }

    const sub = control.subscribe(() => invoke);

    model = sub.proxy;
    invoke();

    return sub.commit();
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