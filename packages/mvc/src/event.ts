import { Control, control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  KeysExpected: (key) =>
    `Key "${key}" was expected in current update.`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  select: P | P[] | null | undefined,
  callback: (this: T, keys: Model.Event<T>[] | null | false) => void,
  once?: boolean){

  return control(source, self => {
    const keys = watch(self, select);

    const cb: Control.OnSync = key => {
      if(keys === null){
        if(key === null){
          callback.call(source, once && key !== null ? false : null);
        }
      }
      else if(!keys || keys.includes(key as P)){
        if(once)
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
  select?: P | P[] | null,
  timeout?: number){

  return new Promise<any>((resolve, reject) => {
    if(timeout === 0){
      // = controls() instead?
      const { frame } = control(source);

      if(!frame.size){
        resolve(false);
        return;
      }
      else if(typeof select == "string" && !frame.has(select)){
        reject(Oops.KeysExpected(select));
        return;
      }
    }

    const self = control(source);
    const keys = watch(self, select);

    const removeListener = self.addListener(key => {
      if(key === null)
        resolve(keys !== null ? false : null);

      else if(!keys || keys.includes(key as P)){
        const single = key && select === key;
        
        removeListener();
        return () => 
          resolve(single ? self.state[key] : self.latest);
      }
    });

    if(timeout as number > 0)
      setTimeout(() => {
        removeListener();
        resolve(false);
      }, timeout);
  });
}

export function watch<T extends Model, P extends Model.Event<T>>(
  from: Control, select: P | P[] | null | undefined){

  const keys = typeof select == "string" ? [ select ] : select;
  const source = from.subject as any;

  if(keys)
    for(const key of keys)
      try { void source[key] }
      catch(e){}

  return keys;
}

export function watch2<T extends Model, P extends Model.Event<T>>(
  from: Control, select: P | P[] | null | undefined){

  const keys = typeof select == "string" ? [ select ] : select;
  const source = from.subject as any;

  if(keys)
    for(const key of keys)
      try { void source[key] }
      catch(e){}

  return keys;
}