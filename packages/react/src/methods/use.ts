import { Model } from '@expressive/mvc';

import { Pragma } from '.';

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (
      this: Model.Init<T>,
      apply?: Model.Assign<T>,
      repeat?: boolean
    ): T;

    function use <T extends Model> (
      this: Model.Init<T>,
      callback?: Model.Callback<T>,
      repeat?: boolean
    ): T;
  }
}

Model.use = function <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T> | Model.Callback<T>,
  repeat?: boolean){

  const outer = Pragma.useContext();
  const getter = Pragma.useFactory((refresh) => {
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this(argument);
    const context = outer.push({ instance });
    const unwatch = instance.get(current => {
      local = current;

      if(enabled)
        refresh();
    });

    function didMount(){
      enabled = true;
      return () => {
        unwatch();
        instance.set(null);
        context.pop()
      }
    }

    return (props?: Model.Assign<T> | Model.Callback<T>) => {
      Pragma.useMount(didMount);

      if(repeat && enabled && props){
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

      return local; 
    };
  });

  return getter(argument);
}