import { Context, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, Context>();

export function usePeerContext(instance: Model){
  const applied = Applied.get(instance);

  if(applied)
    useLookup();

  else if(applied === undefined){
    const pending = Pending.get(instance);

    if(pending){
      const local = useLookup();

      pending.forEach(init => init(local));
      Applied.set(instance, local);
      Pending.delete(instance);
    }
  }
}

export function setContext(model: Model, has: Context){
  const pending = Pending.get(model);
    
  if(pending)
    pending.forEach(cb => cb(has));
}

export function hasContext(model: Model){
  let pending = Pending.get(model)!;

  if(!pending)
    Pending.set(model, pending = []);

  return (callback: (got: Context) => void) => {
    const applied = Applied.get(model);

    if(applied)
      callback(applied);
    else
      pending.push(callback);
  }
}