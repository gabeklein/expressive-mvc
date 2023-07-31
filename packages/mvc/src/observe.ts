import { Callback } from '../types';
import { addListener, control, watch } from './control';
import { entries, keys } from './helper/object';
import { Model } from './model';
import { attempt } from './suspense';

export function extract <T extends Model, P extends Model.Key<T>> (
  target: T,
  argument?: P | P[],
  callback?: Function){

  const cache = new Map<unknown, any>();
  const self = control(target, true);

  function get(value: unknown, select?: string[]){
    if(value instanceof Model){
      let flat = cache.get(value);

      if(!flat){
        cache.set(value, flat = {});

        const { state } = control(value);
        
        entries(state).forEach(([key, value]) => {
          if(!select || select.includes(key))
            flat[key] = get(value);
        })
      }

      return flat;
    }

    return value;
  }

  const extract = typeof argument == "string"
    ? () => get(self.state[argument])
    : () => get(self.subject, argument);

  if(typeof callback != "function")
    return extract();

  const select = typeof argument == "string" ? [argument] : argument!;
  const invoke = () => callback(extract(), self.latest || {});

  for(const key of select)
    try {
      self.subject[key];
    }
    catch(e){
      // TODO: should this be caught?
    }

  invoke();

  return addListener(target, key => {
    if(select.includes(key as P))
      return invoke;
  });
}

export function update<T extends Model>(
  target: T,
  arg1?: number,
  arg2?: Model.Predicate){

  return new Promise<any>((resolve, reject) => {
    control(target, self => {
      if(!keys(self.frame).length && typeof arg1 != "number"){
        resolve(false);
        return;
      }
  
      const callback = () => resolve(self.latest);
  
      const remove = addListener(target, (key) => {
        if(typeof arg2 !== "function" || key && arg2(key) === true){
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

  return control(source, () => {
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
    addListener(source, key => 
      key === null || refresh === null ? refresh : undefined
    );

    invoke();
    refresh = invoke;

    return () => refresh = null;
  });
}