import { Model } from '@expressive/mvc';

import { setContext, useContext, useEffect, useState } from './useContext';

const PENDING = new WeakMap<Model, () => void>();

export function useLocal <T extends Model> (
  this: Model.New<T>,
  argument?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(() => {
    let apply: ((arg?: Model.Values<T> | ((instance: T) => void)) => void) | undefined;
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this();

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

    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      argument = props;

      if(apply && enabled){
        enabled = false;
        apply();

        const update = instance.set();

        if(update)
          update.then(() => enabled = true);
        else
          enabled = true;
      }
      
      const context = useContext();

      setContext(instance, context);
      context.has(instance);

      useEffect(() => {
        enabled = true;
        return () => {
          release();
          instance.set(null);
        }
      }, []);

      return local; 
    };
  });

  return state[0](argument);
}

// This occurs after instructions but before state loads values.
Model.on((_, subject) => {
  const pending = PENDING.get(subject);

  if(pending)
    pending();

  return null;
})