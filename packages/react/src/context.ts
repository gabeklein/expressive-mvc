import { Context, Model } from '@expressive/mvc';
import { createContext, useContext, useMemo } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

export const Pending = new WeakMap<{}, ((context: Context) => void)[]>();

export function fetchRelative<T extends Model>(
  type: Model.Class<T>,
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

export function fetchSimple <T extends Model, R>(
  type: Model.Class<T>,
  memo: (got: T | undefined) => R
){
  const context = useLookup();
  return useMemo(() => memo(context.get(type)), []);
}

export function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}