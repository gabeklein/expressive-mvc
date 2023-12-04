import { Model } from '@expressive/mvc';

import { setContext, useEffect, useState } from './useContext';

const PENDING_MERGE = new WeakMap<Model, () => void>();

export function useLocal <T extends Model> (
  this: Model.New<T>,
  argument?: Model.Values<T> | Model.use.Callback<T>,
  repeat?: boolean){

  const state = useState(() => {
    let shouldApply = !!argument;
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this();

    PENDING_MERGE.set(instance, () => apply(argument));

    instance.set(0);

    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    function apply(props?: Model.Values<T> | ((instance: T) => void)){
      enabled = false;

      if(typeof props == "function")
        props(instance);

      else if(props)
        for(const key in instance)
          if(props.hasOwnProperty(key))
            instance[key] = (props as any)[key];

      if(!repeat)
        shouldApply = false;

      const update = instance.set();

      if(update)
        update.then(() => enabled = true);
      else
        enabled = true;
    }

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(shouldApply)
        apply(props);

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

Model.on((_, source) => {
  const cb = PENDING_MERGE.get(source);
  return cb && cb() || null;
})