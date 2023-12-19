import { Model } from '@expressive/mvc';

import { setContext, useContext, useEffect, useState } from './useContext';

export function useLocal <T extends Model> (
  this: Model.New<T>,
  argument?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(() => {
    let enabled: boolean | undefined;
    let local: T;

    function apply(this: T){
      if(typeof argument == "function")
        argument(this);

      else if(argument)
        for(const key in this)
          if(argument.hasOwnProperty(key))
            this[key] = (argument as any)[key];
    }

    const instance = this.new(apply);
    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      argument = props;

      if(repeat && enabled){
        enabled = false;
        apply.call(instance);

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