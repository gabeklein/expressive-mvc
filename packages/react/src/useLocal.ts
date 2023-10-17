import { Model } from '@expressive/mvc';

import { setContext, useEffect, useState } from './useContext';

export function useLocal <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T> | Model.UseCallback<T>,
  repeat?: boolean){

  const state = useState(() => {
    let shouldApply = !!apply;
    let enabled: boolean | undefined;
    let local: T;

    const instance = this.new() as T;
    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(shouldApply){
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

  return state[0](apply);
}