import { Context, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

export const Pending = new WeakMap<{}, ((context: Context) => void)[]>();

export function hasModel<T extends Model>(
  type: Model.Type<T>,
  relativeTo: Model,
  callback: (got: T | undefined) => void
){
  let pending = Pending.get(relativeTo);
    
  if(!pending)
    Pending.set(relativeTo, pending = []);

  pending.push(context => {
    callback(context.get(type));
  })
}

const Applied = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  const applyPeers = Applied.get(instance);

  if(applyPeers)
    useLookup();

  else if(applyPeers === undefined){
    const pending = Pending.get(instance);

    if(pending){
      const local = useLookup();

      pending.forEach(init => init(local));
      Pending.delete(instance);
      Applied.set(instance, true);
    }
  }
}