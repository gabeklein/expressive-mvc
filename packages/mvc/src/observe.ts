import { control } from './control';
import { entries, keys } from './helper/object';
import { Model } from './model';

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

  const select = typeof argument == "string" ? [argument] : argument;
  const invoke = () => callback(extract(), self.latest || {});

  if(select)
    for(const key of select)
      try {
        self.subject[key];
      }
      catch(e){
        // TODO: should this be caught?
      }

  invoke();

  return self.addListener(key => {
    if(!select || select.includes(key as P)){
      return invoke;
    }
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
  
      const remove = self.addListener((key) => {
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