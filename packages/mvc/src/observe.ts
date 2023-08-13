import { Callback } from '../types';
import { control, watch } from './control';
import { entries, isFrozen } from './helper/object';
import { Model } from './model';

export function extract <T extends Model> (target: T){
  const cache = new Map<unknown, any>();

  function get(value: unknown){
    if(value instanceof Model){
      let flat = cache.get(value);

      if(!flat){
        cache.set(value, flat = {});

        const { state } = control(value);
        
        entries(state).forEach(([key, value]) => {
          flat[key] = get(value);
        })
      }

      return flat;
    }

    return value;
  }

  return get(target);
}

export function nextUpdate<T extends Model>(
  target: T,
  arg1?: number,
  arg2?: (key: string) => boolean | void){

  return new Promise<any>((resolve, reject) => {
    control(target, self => {
      if(isFrozen(self.frame) && typeof arg1 != "number"){
        resolve(false);
        return;
      }
  
      const callback = () => resolve(self.frame);
  
      const remove = self.addListener((key) => {
        if(!arg2 || key && arg2(key) === true){
          remove();
  
          if(timeout)
            clearTimeout(timeout);
  
          return callback;
        }
      });
  
      const timeout = typeof arg1 == "number" && setTimeout(() => {
        remove();
        reject(arg1);
      }, arg1);
    })
  });
}

export function effect<T extends Model>(
  target: T, callback: Model.Effect<T>){

  return control(target, self => {
    let refresh: (() => void) | null | undefined;
    let unSet: Callback | Promise<void> | void;

    function invoke(){
      try {
        if(typeof unSet == "function")
          unSet();
    
        unSet = callback.call(target, target);
    
        if(typeof unSet != "function")
          unSet = undefined;
      }
      catch(err){
        if(err instanceof Promise){
          err.finally(() => (refresh = invoke)());
          refresh = undefined;
        }
        else 
          console.error(err);
      }
    }

    target = watch(target, () => refresh);
    self.addListener(key => 
      key === null || refresh === null ? refresh : undefined
    );

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}

export function attempt(fn: () => any): any {
  function retry(err: unknown){
    if(err instanceof Promise)
      return err.then(compute);
    else
      throw err;
  }

  function compute(): any {
    try {
      const output = fn();

      return output instanceof Promise
        ? output.catch(retry)
        : output;
    }
    catch(err){
      return retry(err);
    }
  }

  return compute();
}