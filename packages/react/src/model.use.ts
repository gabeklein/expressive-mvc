import { Model, Context, createEffect } from '@expressive/mvc';

import { Pragma } from './adapter';

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (
      this: Model.Init<T>,
      apply?: Model.Assign<T>
    ): T;

    function use <T extends Model> (
      this: Model.Init<T>,
      callback?: Model.Callback<T>
    ): T;
  }
}

Model.use = function <T extends Model> (
  this: Model.Init<T>,
  argument?: Model.Assign<T> | Model.Callback<T>){

  const context = Context.use(true);
  const render = Pragma.useFactory((refresh) => {
    let enabled: boolean | undefined;
    let local: T;

    const instance = new this(argument);

    context.include(instance);
  
    const unwatch = createEffect(instance, current => {
      local = current;

      if(enabled) 
        refresh();
    });

    function didMount(){
      enabled = true;
      return () => {
        unwatch();
        context.pop()
        instance.set(null);
      }
    }

    return (props?: Model.Assign<T> | Model.Callback<T>) => {
      Pragma.useLifecycle(didMount);

      return local; 
    };
  });

  return render(argument);
}