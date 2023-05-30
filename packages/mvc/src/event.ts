import { control } from './control';
import { Model } from './model';

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  select: P | P[] | undefined,
  callback: (this: T, keys: Model.Event<T>[] | null) => void,
  once?: boolean){

  return control<any>(source, self => {
    const { subject } = self;

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
      if(!select || select.includes(key as P)){
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

  return new Promise<any>((resolve) => {
    if(timeout === 0){
      const self = control(source, true);

      if(self.frame.size){
        const remove = self.addListener(() => {
          remove();
          return () => resolve(self.latest);
        });
      }
      else
        resolve(false);
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