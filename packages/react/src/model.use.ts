import { Model, Context, createEffect } from '@expressive/mvc';

import { Pragma } from './compat';

declare module '@expressive/mvc' {
  namespace Model {
    function use<T extends Model>(this: Init<T>, ...args: Argument<T>[]): T;
  }
}

interface Compat extends Model {
  render?(...props: Model.Argument<this>[]): void;
}

Model.use = function <T extends Compat>(
  this: Model.Init<T>,
  ...args: Model.Argument<T>[]
) {
  const context = Context.use(true);
  const state = Pragma.useState(() => {
    let ready: boolean | undefined;
    let local: T;

    const instance = new this(...args);

    context.include(instance);

    const unwatch = createEffect(instance, (current) => {
      local = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        unwatch();
        context.pop();
        instance.set(null);
      };
    }

    return (...args: Model.Argument<T>[]) => {
      ready = false;

      Pragma.useEffect(didMount, []);
      Promise.all(
        args.map((arg) => typeof arg == 'object' && instance.set(arg))
      ).finally(() => {
        ready = true;
      });

      if (instance.render) instance.render(...args);

      return local;
    };
  });

  return state[0](...args);
};
