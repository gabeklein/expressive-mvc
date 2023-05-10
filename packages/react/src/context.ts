import { Context, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  const applied = Applied.get(instance);

  if(applied)
    useLookup();

  else if(applied === undefined){
    const pending = Pending.get(instance);

    if(pending){
      const local = useLookup();

      pending.forEach(init => init(local));
      Pending.delete(instance);
      Applied.set(instance, true);
    }
  }
}

export function getPeerContext<T extends Model>(
  type: Model.Type<T>,
  relativeTo: Model,
  callback: (got?: T) => void
){
  let pending = Pending.get(relativeTo);
    
  if(!pending)
    Pending.set(relativeTo, pending = []);

  pending.push(context => {
    callback(context.get(type));
  })
}

export function setPeerContext(model: Model, context: Context){
  const pending = Pending.get(model);

  if(pending)
    pending.forEach(cb => cb(context));
}