import { Callback } from '../types';
import { Control, control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  KeysExpected: (key) => `Key "${key}" was expected in current update.`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  select: P | P[] | null | undefined,
  callback: (this: T, keys: Model.Event<T>[] | null | false) => void,
  once?: boolean){

  return control(source, self => {
    const removeListener = watch(self, select, key => {
      if(once)
        removeListener();

      if(typeof key == "string")
        return () => callback.call(source, self.latest!);

      else if(key !== undefined)
        callback.call(source, once ? key : null);
    })

    return removeListener;
  });
}

export function awaitUpdate<T extends Model, P extends Model.Event<T>>(
  source: T,
  select?: P | P[] | null,
  timeout?: number){

  const self = control(source);

  return new Promise<any>((resolve, reject) => {
    if(timeout === 0){
      if(!self.frame.size)
        resolve(false);
      else if(typeof select == "string" && !self.frame.has(select))
        reject(Oops.KeysExpected(select));
      else {
        const remove = self.addListener(() => {
          remove();
          return () => resolve(self.latest);
        });
      }
    }
    else {
      const removeListener =
        watch(self, select, key => {
          if(key === null)
            resolve(key);
          else {
            removeListener();
            return () => {
              resolve(key && select === key ? self.state[key] : self.latest);
            }
          }
        });
  
      if(timeout as number > 0)
        setTimeout(() => {
          removeListener();
          resolve(false);
        }, timeout);
    }
  });
}

export function watch<T extends Model, P extends Model.Event<T>>(
  from: Control,
  select: P | P[] | null | undefined,
  callback: (key: undefined | null | false | Model.Event<T>) => Callback | void){

  const keys = typeof select == "string" ? [ select ] : select;
  const source = from.subject as any;

  if(keys)
    for(const key of keys)
      try { void source[key] }
      catch(e){}

  return from.addListener(key => {
    if(key === null)
      return callback(keys === null ? null : false);

    if(keys === null)
      return;

    if(!keys || !key || keys.includes(key as P))
      return callback(key);
  });
}