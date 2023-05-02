import { Context, issues, Model } from '@expressive/mvc';
import { createContext, useContext } from 'react';

import { useComputed, useSubscriber } from './useSubscriber';

export const LookupContext = createContext(new Context());
export const useLookup = () => useContext(LookupContext);

export const Oops = issues({
  AmbientRequired: (requested, requester) =>
    `Attempted to find an instance of ${requested} in context. It is required by ${requester}, but one could not be found.`
});

const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

export function useFromContext <T extends Model> (
  this: (typeof Model & Model.Type<T>),
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean){

  const factory = this.has(arg1 !== false);

  if(typeof arg1 == "boolean"){
    let model!: T;
    factory($ => model = $);
    return model;
  }

  return arg1
    ? useComputed(factory, arg1, arg2)
    : useSubscriber(factory);
}

export function hasContext<T extends Model>(
  this: Model.Type<T>,
  required?: boolean | undefined,
  relativeTo?: Model
): any {
  if(relativeTo)
    return (callback: (got: T) => void) => {
      let pending = Pending.get(relativeTo);
      
      if(!pending)
        Pending.set(relativeTo, pending = []);
    
      pending.push(context => {
        const got = context.get<T>(this, false);
    
        if(got)
          callback(got);
        else if(required)
          throw Oops.AmbientRequired(this, relativeTo);
      })
    }

  const context = useLookup()

  return (callback?: (got: T) => void) => {
    const got = context.get(this, required);

    if(callback && got)
      callback(got);
  }
}

export function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useLookup();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useLookup();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

export function setPeers(context: Context, onto: Model){
  const pending = Pending.get(onto);

  if(pending)
    pending.forEach(cb => cb(context));
}