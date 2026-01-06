import { Model, Context, createEffect } from '@expressive/mvc';

import { Hook } from './adapter';

declare module '@expressive/mvc' {
  namespace Model {
    function use <T extends Model> (this: Model.Init<T>, ...args: Argument<T>[]): T;
  }
}

interface Compat extends Model {
  render?(...props: Model.Argument<this>[]): React.ReactNode;
  fallback?: React.ReactNode;
}

Model.use = function <T extends Compat> (
  this: Model.Init<T>,
  ...args: Model.Argument<T>[]){

  const context = Context.use(true);
  const state = Hook.useState(() => {
    const refresh = () => state[1](x => x.bind(null));
    let ready: boolean | undefined;
    let local: T;

    const instance = new this(...args);

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

    return (...args: Model.Argument<T>[]) => {
      Hook.useEffect(didMount, []);

      ready = false;
      Promise.all(args.map(arg => {
        if(typeof arg == "object")
          return instance.set(arg as Model.Assign<T>);
      })).then(() => ready = true);

      if(instance.render)
        instance.render(...args);

      return local; 
    };
  });

  return state[0](...args);
}