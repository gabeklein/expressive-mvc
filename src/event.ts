import { Control } from './control';
import { issues } from './helper/issues';
import { Model } from './model';

export const Oops = issues({
  Timeout: (keys, timeout) => 
    `No update seen for [${keys}] within ${timeout}.`,

  KeysExpected: (key) =>
    `Key "${key}" was expected in current update.`,

  StrictUpdate: () => 
    `Expected update but none in progress.`,

  StrictNoUpdate: () =>
    `Update is not expected but one is in progress!`
});

export function addEventListener<T extends Model, P extends Model.Event<T>> (
  source: T,
  arg1: P | P[],
  arg2: Function,
  arg3?: boolean){

  const single = typeof arg1 == "string";

  if(typeof arg1 == "string")
    arg1 = [arg1];

  return Control.for(source, control => {
    for(const key of arg1)
      try { void (source as any)[key] }
      catch(e){}

    const invoke: Control.OnAsync = single
      ? () => arg2.call(source, control.state.get(arg1), arg1)
      : (frame) => arg2.call(source, frame);

    const removeListener =
      control.addListener(key => {
        if(!key && !arg1.length)
          invoke([]);
          
        if(arg1.includes(key as P)){
          if(arg3)
            removeListener();

          return invoke;
        }
      });

    return removeListener;
  });
}

export function awaitUpdate<T extends Model, P extends Model.Event<T>>(
  source: T,
  arg1?: boolean | null | P | P[],
  arg2?: number){

  const single = typeof arg1 == "string";
  const keys =
    typeof arg1 == "string" ? [ arg1 ] :
    typeof arg1 == "object" ? arg1 : 
    undefined;

  return new Promise<any>((resolve, reject) => {
    const timeout = (message: string) => {
      const k = keys ? keys.join(", ") : "any";

      removeListener();
      reject(Oops.Timeout(k, message));
    }

    const removeListener = Control.for(source, control => {
      const pending = control.frame;

      if(keys === null){
        if(pending.size)
          reject(Oops.StrictNoUpdate())
        else
          resolve(null);

        return;
      }

      if(keys){
        if(keys.length){
          if(arg2 === 0 && single && !pending.has(keys[0])){
            reject(Oops.KeysExpected(keys[0]));
            return;
          }
          else for(const key of keys)
            try { void (source as any)[key] }
            catch(e){}
        }
      }
      else if(!pending.size && arg1 === true || arg2 === 0){
        reject(Oops.StrictUpdate());
        return;
      }
      else
        control.waiting.add(resolve);

      return control.addListener(key => {
        if(!key){
          if(keys && !keys.length)
            resolve([]);
          else
            timeout(`lifetime of ${source}`);
        }
        else if(!keys || keys.includes(key as P)){
          removeListener();
          return keys =>
            resolve(single ? control.state.get(key) : keys)
        }
      });
    })

    if(arg2 && typeof arg2 == "number")
      setTimeout(() => timeout(`${arg2}ms`), arg2);
  });
}