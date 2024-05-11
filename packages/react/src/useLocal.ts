import { Context, Model } from '@expressive/mvc';

import { useContextState, useOnMount } from './useContext';

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (this: Model.Init<T>, apply?: Model.Assign<T>, repeat?: boolean): T;

    function use <T extends Model> (this: Model.Init<T>, callback?: Model.Callback<T>, repeat?: boolean): T;
  }
}

Model.use = function <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T> | Model.Callback<T>,
  repeat?: boolean){

  const getter = useContextState((outer, refresh) => {
    let enabled: boolean | undefined;
    let context: Context;
    let local: T;

    const instance = new this(argument as Model.Argument);
    const release = instance.get(current => {
      local = current;

      if(enabled)
        refresh();
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

      useOnMount(() => {
        enabled = true;
        return () => {
          release();
          instance.set(null);
          context.pop()
        }
      });

      return local; 
    };
  });

  return getter(argument);
}