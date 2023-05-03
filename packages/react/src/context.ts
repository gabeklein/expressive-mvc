import { Context, issues, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

export const Pending = new WeakMap<{}, ((context: Context) => void)[]>();

export function fetch<T extends Model>(
  type: Model.Type<T>,
  required?: boolean | undefined,
  relativeTo?: Model
): any {
  if(relativeTo)
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

  const context = useLookup()

  return (callback?: (got: T) => void) => {
    const got = context.get(type, required);

    if(callback && got)
      callback(got);
  }
}

export function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}