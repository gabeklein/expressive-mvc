import { Callback } from '../types';
import { control, watch } from './control';
import { entries, isFrozen } from './helper/object';
import { Model } from './model';
import { attempt } from './suspense';

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
  source: T, callback: Model.Effect<T>){

  return control(source, self => {
    let unSet: Callback | Promise<void> | void;
    let busy = false;

    function invoke(){
      if(busy)
        return;

      const output = attempt(() => {
        if(typeof unSet == "function")
          unSet();
    
        unSet = callback.call(source, source);
    
        if(typeof unSet !== "function")
          unSet = undefined;
      })

      if(output instanceof Promise){
        output.finally(() => busy = false);
        busy = true;
      }
    }

    let refresh: (() => void) | null;

    source = watch(source, () => refresh);
    self.addListener(key => 
      key === null || refresh === null ? refresh : undefined
    );

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}