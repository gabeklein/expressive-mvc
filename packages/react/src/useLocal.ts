import { Context, Model } from '@expressive/mvc';

import { useShared, useEffect, useState } from './useContext';

export function useLocal <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T> | Model.Callback<T>,
  repeat?: boolean){

  const outer = useShared();
  const state = useState(() => {
    let enabled: boolean | undefined;
    let context: Context;
    let local: T;

    Model.is(this);

    const instance = new this(argument as Model.Argument);
    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Assign<T> | Model.Callback<T>) => {
      if(!context)
        context = outer.push({ instance });

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

      useEffect(() => {
        enabled = true;
        return () => {
          release();
          instance.set(null);
          context.pop()
        }
      }, []);

      return local; 
    };
  });

  return state[0](argument);
}