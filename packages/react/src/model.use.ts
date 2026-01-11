import { Model, Context, watch } from '@expressive/mvc';

import { Pragma } from './adapter';

interface UseModel extends Model {
  use?(...args: any[]): Promise<void> | void;
}

declare module '@expressive/mvc' {
  namespace Model {
    type UseArgs<T extends UseModel> = T['use'] extends (
      ...args: infer A
    ) => any
      ? A
      : Args<T>;

    function use<T extends Model>(this: Init<T>, ...args: UseArgs<T>): T;
  }
}

Model.use = function <T extends UseModel>(this: Model.Init<T>, ...args: any[]) {
  const context = Context.use(true);
  const state = Pragma.useState(() => {
    let ready: boolean | undefined;
    let active: T;

    const instance = new this((x) =>
      x.use ? Promise.resolve(x.use(...args)) : args
    );

    context.use(instance);

    const unwatch = watch(instance, (current) => {
      active = current;

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

      return active;
    };
  });

  return state[0](...args);
};
