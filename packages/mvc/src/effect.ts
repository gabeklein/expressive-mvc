import { addListener, control, watch } from './control';
import { Model } from './model';
import { mayRetry } from './suspense';

import type { Callback } from '../types';

export function createEffect<T extends Model>(
  source: T, callback: Model.Effect<T>){

  return control(source, self => {
    let unSet: Callback | Promise<void> | void;
    let busy = false;

    function invoke(){
      if(busy)
        return;

      const output = mayRetry(() => {
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
    addListener(source, key => 
      key === null || refresh === null ? refresh : undefined
    );

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}