import { control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  KeysExpected: (key) => `Key "${key}" was expected in current update.`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  select: P | P[] | undefined,
  callback: (this: T, keys: Model.Event<T>[] | null) => void,
  once?: boolean){

  return control(source, self => {
    const { subject } = self as any;

    if(typeof select == "string")
      select = [ select ];

    if(select)
      for(const key of select)
        try {
          void subject[key];
        }
        catch(e){
          // TODO: should this be caught?
        }

    const removeListener = self.addListener(key => {
      if(key === null)
        callback.call(subject, null);

      else if(!select || select.includes(key as P)){
        if(once)
          removeListener();

        return () => callback.call(subject, self.latest!);
      }
    });

    return removeListener;
  });
}

export function awaitUpdate<T extends Model, P extends Model.Event<T>>(
  source: T,
  select?: P | P[],
  timeout?: number){

  return new Promise<any>((resolve, reject) => {
    if(timeout === 0){
      const self = control(source);

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
      const remove = addEventListener(source, select, resolve, true);
  
      if(timeout as number > 0)
        setTimeout(() => {
          remove();
          resolve(false);
        }, timeout);
    }
  });
}