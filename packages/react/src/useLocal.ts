import { Model } from '@expressive/mvc';

import { setContext, useEffect, useState } from './useContext';

const PENDING = new WeakMap<Model, () => void>();

export function useLocal <T extends Model> (
  this: Model.New<T>,
  argument?: Model.Values<T> | Model.use.Callback<T>,
  repeat?: boolean){

  const state = useState(() => {
    let apply: ((arg?: Model.Values<T> | Model.use.Callback<T>) => void) | undefined;
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this();

    if(argument){
      apply = arg => {
        if(typeof arg == "function")
          arg(instance);
  
        else if(arg)
          for(const key in instance)
            if(arg.hasOwnProperty(key))
              instance[key] = (arg as any)[key];
  
        if(!repeat)
          apply = undefined;
      }

      PENDING.set(instance, apply.bind(null, argument));
    }

    instance.set(0);

    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(apply && enabled){
        enabled = false;

        apply(props);

        const update = instance.set();

        if(update)
          update.then(() => enabled = true);
        else
          enabled = true;
      }

      setContext(instance);

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

Model.on((_, subject) => {
  const pending = PENDING.get(subject);

  if(pending)
    pending();

  return null;
})