import { Control, control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  KeysExpected: (key) =>
    `Key "${key}" was expected in current update.`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  select: P | P[],
  callback: (this: T, keys: Model.Event<T>[]) => void,
  required?: boolean){

  const keys = typeof select == "object" ? select : [select];

  return control(source, self => {
    for(const key of keys)
      try { void (source as any)[key] }
      catch(e){}

    const cb: Control.OnSync = key => {
      if(key === null && !keys.length)
        callback.call(source, []);
        
      if(keys.includes(key as P)){
        if(required)
          removeListener();

        return () => callback.call(source, self.latest!);
      }
    }

    const removeListener = self.addListener(cb);

    return removeListener;
  });
}

export function awaitUpdate<T extends Model, P extends Model.Event<T>>(
  source: T,
  arg1?: P | P[],
  arg2?: number){

  const keys = typeof arg1 == "string" ? [ arg1 ] : arg1;
  const self = control(source);

  return new Promise<any>((resolve, reject) => {
    if(arg2 === 0){
      if(!self.frame.size){
        resolve(false);
        return;
      }
      else if(typeof arg1 == "string" && !self.frame.has(arg1)){
        reject(Oops.KeysExpected(arg1));
        return;
      }
    }

    if(keys && keys.length)
      for(const key of keys)
        if(key in source)
          try { void source[key as keyof T] }
          catch(e){}

    const removeListener = self.addListener(key => {
      if(key === null)
        resolve(!keys || keys.length ? false : [])

      else if(!keys || keys.includes(key as P)){
        removeListener();
        return () => {
          resolve(key && arg1 === key ? self.state[key] : self.latest);
        }
      }
    });

    if(arg2 as number > 0)
      setTimeout(() => {
        removeListener();
        resolve(false);
      }, arg2);
  });
}