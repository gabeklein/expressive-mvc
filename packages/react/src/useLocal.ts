import { Model } from '@expressive/mvc';

import { setContext, useContext, useEffect, useState } from './useContext';

function useLocal <T extends Model> (
  this: Model.New<T>,
  arg?: Model.Assign<T> | ((i: T) => void),
  repeat?: boolean){

  const state = useState(() => {
    let enabled: boolean | undefined;
    let local: T;

    const instance = this.new(
      typeof arg == "function" ? x => { arg } : arg
    );

    const release = instance.get(current => {
      local = current;

      if(enabled)
        state[1]((x: Function) => x.bind(null));
    });

    return (props?: Model.Assign<T> | ((i: T) => void)) => {
      if(repeat && enabled) {
        enabled = false;

        if(typeof props == "function")
          props(instance);
        else if(typeof props == "object")
          instance.set(props);

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

  return state[0](arg);
}

export { useLocal }