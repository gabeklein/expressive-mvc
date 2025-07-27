import { Model, Context, createEffect } from '@expressive/mvc';

import { Pragma } from './adapter';

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

  const context = Context.use(true);
  const render = Pragma.useFactory((refresh) => {
    let ready: boolean | undefined;
    let local: T;

    const instance = new this(argument);

    context.include(instance);
  
    const unwatch = createEffect(instance, current => {
      local = current;

      if(ready) 
        refresh();
    });

    function didMount(){
      ready = true;
      return () => {
        unwatch();
        context.pop()
        instance.set(null);
      }
    }

    return (props?: Model.Assign<T> | Model.Callback<T>) => {
      Pragma.useLifecycle(didMount);

      if(ready && repeat && props){
        ready = false;

        if(typeof props == "function"){
          props.call(instance, instance);
          props = undefined
        }

        const update = instance.set(props);

        if(update)
          update.then(() => ready = true);
        else
          ready = true;
      }

      return local; 
    };
  });

  return render(argument);
}