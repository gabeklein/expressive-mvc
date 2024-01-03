import { Model } from '@expressive/mvc';

import { useContext, useEffect, useState } from './useContext';

export function useLocal <T extends Model> (
  this: Model.Type<T>,
  argument?: Model.Assign<T> | Model.Callback<T>,
  repeat?: boolean){

  const state = useState(() => {
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this(argument as Model.Argument);
    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Assign<T> | Model.Callback<T>) => {
      if(repeat && enabled) {
        enabled = false;

        if(typeof props == "function")
          props.call(instance, instance);
        else if(typeof props == "object")
          instance.set(props);

        const update = instance.set();

        if(update)
          update.then(() => enabled = true);
        else
          enabled = true;
      }
      
      const context = useContext();

      context.has(instance);

      if(!local)
        instance.set();

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