import { Model, Context, createEffect } from '@expressive/mvc';

import { Pragma } from './adapter';

declare module '@expressive/mvc' {
  namespace Model {
    interface Usable extends Model {
      use?(...props: any[]): Promise<void> | void;
    }

    type UseArgs<T extends Usable> = T extends {
      use(...props: infer P): any;
    }
      ? P
      : Model.Argument<T>[];

    function use<T extends Model>(this: Init<T>, ...args: UseArgs<T>): T;
  }
}

Model.use = function <T extends Model.Usable>(
  this: Model.Init<T>,
  ...args: any[]
) {
  const context = Context.use(true);
  const state = Pragma.useState(() => {
    let ready: boolean | undefined;
    let local: T;

    const instance = new this((x) =>
      x.use ? Promise.resolve(x.use(...args)) : args
    );

    context.use(instance);

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

      Promise.resolve(
        instance.use
          ? instance.use(...args)
          : Promise.all(
              args.map((arg) => typeof arg == 'object' && instance.set(arg))
            )
      ).finally(() => {
        ready = true;
      });

      return local;
    };
  });

  return state[0](...args);
};
