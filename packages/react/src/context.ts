import { Context, issues, Model } from '@expressive/mvc';
import { createContext, useContext, useMemo } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

export const Pending = new WeakMap<{}, ((context: Context) => void)[]>();

export function fetchRelative<T extends Model>(
  type: Model.Class<T>,
  required: boolean | undefined,
  relativeTo: Model
){
  return (callback: (got: T) => void) => {
    let pending = Pending.get(relativeTo);
    
    if(!pending)
      Pending.set(relativeTo, pending = []);
  
    pending.push(context => {
      const got = context.get<T>(type, false);
  
      if(got)
        callback(got);
      else if(required)
        throw Oops.AmbientRequired(type, relativeTo);
    })
  }
}

export function fetchSimple <T extends Model, R>(
  type: Model.Class<T>,
  memo: (got: T | undefined) => R
){
  const context = useLookup();
  return useMemo(() => memo(context.get(type, false)), []);
}

export function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}