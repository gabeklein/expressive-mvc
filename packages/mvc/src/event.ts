import { control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  KeysExpected: (key) =>
    `Key "${key}" was expected in current update.`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  arg1: P | P[],
  arg2: (this: T, keys: Model.Event<T>[]) => void,
  arg3?: boolean){

  if(typeof arg1 == "string")
    arg1 = [arg1];

  return control(source, self => {
    for(const key of arg1)
      try { void (source as any)[key] }
      catch(e){}

    const removeListener =
      self.addListener(key => {
        if(!key && !arg1.length)
          arg2.call(source, []);
          
        if(arg1.includes(key as P)){
          if(arg3)
            removeListener();

          return arg2.bind(source);
        }
      });

    return removeListener;
  });
}

export function awaitUpdate<T extends Model, P extends Model.Event<T>>(
  source: T,
  arg1?: P | P[],
  arg2?: number){

  const single = typeof arg1 == "string";
  const keys =
    typeof arg1 == "string" ? [ arg1 ] :
    typeof arg1 == "object" ? arg1 : 
    undefined;

  return new Promise<any>((resolve, reject) => {
    const removeListener = control(source, self => {
      const pending = self.frame;

      if(arg2 === 0){
        if(!pending.size){
          resolve(false);
          return;
        }
        else if(single && !pending.has(arg1)){
          reject(Oops.KeysExpected(arg1));
          return;
        }
      }

      if(!keys)
        self.waiting.add(resolve);

      else if(keys.length)
        for(const key of keys)
          if(key in source)
            try { void source[key as keyof T] }
            catch(e){}

      return self.addListener(key => {
        if(!key){
          if(keys && !keys.length)
            resolve([]);
          else {
            removeListener();
            resolve(false);
          }
        }
        else if(!keys || keys.includes(key as P)){
          removeListener();
          return keys =>
            resolve(single ? self.state.get(key) : keys)
        }
      });
    })

    if(arg2 as number > 0)
      setTimeout(() => {
        removeListener();
        resolve(false);
      }, arg2);
  });
}