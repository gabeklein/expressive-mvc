import { control, watch } from './control';
import { Model } from './model';

export function extract <T extends Model> (target: T){
  const cache = new Map<unknown, any>();

  function get(value: unknown){
    if(value instanceof Model){
      let flat = cache.get(value);

      if(!flat){
        cache.set(value, flat = {});

        Object.entries(control(value).state).forEach(([key, value]) => {
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
    const self = control(target);

    if(Object.isFrozen(self.frame) && typeof arg1 != "number"){
      resolve(false);
      return;
    }

    const callback = () => resolve(self.frame);

    const remove = self.addListener((key) => {
      if(key === true)
        return;

      if(!arg2 || typeof key == "string" && arg2(key) === true){
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
  });
}

export function effect<T extends Model>(
  target: T, callback: Model.Effect<T>){

  let refresh: (() => void) | null | undefined;
  let unSet: Callback | undefined;

  function invoke(){
    if(unSet)
      unSet();

    try {
      const out = callback.call(target, target);
      unSet = typeof out == "function" ? out : undefined;
    }
    catch(err){
      if(err instanceof Promise){
        err.then(() => (refresh = invoke)());
        refresh = undefined;
      }
      else 
        console.error(err);
    }
  }

  target = watch(target, () => refresh);

  const self = control(target);
  const ready = () => {
    invoke();
    refresh = invoke;
  }

  if(self.state)
    ready();

  self.addListener(key => {
    if(key === true)
      return ready();

    if(!refresh)
      return refresh;

    if(key === null && unSet)
      unSet();
  });

  return () => {
    refresh = null;
  };
}