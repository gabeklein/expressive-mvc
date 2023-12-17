import { Model } from '@expressive/mvc';

import { setContext, useContext, useEffect, useState } from './useContext';

export const PENDING = new WeakMap<Model, () => void>();

export function useLocal <T extends Model> (
  this: Model.New<T>,
  argument?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(() => {
    const instance = new this();
    let apply: (() => void) | undefined;

    if(argument)
      PENDING.set(instance, apply = () => {
        if(typeof argument == "function")
          argument(instance);
  
        else if(argument)
          for(const key in instance)
            if(argument.hasOwnProperty(key))
              instance[key] = (argument as any)[key];
  
        if(!repeat)
          apply = undefined;
      });

    instance.set(0);

    const useLocal = subscribe(instance, () => {
      state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      const local = useLocal(() => {
        if(apply){
          argument = props;
          apply();
        }
      });
      
      const context = useContext();

      setContext(instance, context);
      context.has(instance);

      return local; 
    };
  });

  return state[0](argument);
}

export function subscribe<T extends Model>(
  instance: T, update: () => void){

  let enabled: boolean | undefined;
  let local: T;
  
  const release = instance.get(current => {
    local = current;

    if(enabled)
      update();
  });

  return (apply?: () => void) => {
    if(apply && enabled){
      enabled = false;
      apply();

      const update = instance.set();

      if(update)
        update.then(() => enabled = true);
      else
        enabled = true;
    }

    useEffect(() => {
      enabled = true;
      return () => {
        release();
        instance.set(null);
      }
    }, []);

    return local;
  }
}

// This occurs after instructions but before state loads values.
Model.on((_, subject) => {
  const pending = PENDING.get(subject);

  if(pending)
    pending();

  return null;
})