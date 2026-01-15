import { Model, Context, watch } from '@expressive/mvc';

import { Pragma } from './adapter';

declare module '@expressive/mvc' {
  namespace Model {
    interface Valid {
      use?(...props: any[]): Promise<void> | void;
    }

    type UseArgs<T extends Model> = T extends {
      use(...props: infer P): any;
    }
      ? P
      : Model.Args<T>;

    function use<T extends Model>(this: New<T>, ...args: UseArgs<T>): T;
  }
}

Model.use = function <T extends Model.Valid>(
  this: Model.New<T>,
  ...args: any[]
) {
  const ambient = Context.use();
  const state = Pragma.useState(() => {
    let ready: boolean | undefined;
    let active: T;

    const instance = this.new((x) =>
      x.use ? Promise.resolve(x.use(...args)) : args
    );
    const context = ambient.push(instance);

    watch(instance, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        context.pop();
        instance.set(null);
      };
    }

    return (...args: Model.Args<T>) => {
      Pragma.useEffect(didMount, []);

      if (ready) {
        ready = false;

        Promise.resolve(
          instance.use
            ? instance.use(...args)
            : Promise.all(
                args
                  .flat()
                  .map(
                    (arg) =>
                      typeof arg == 'object' &&
                      instance.set(arg as Model.Assign<T>)
                  )
              )
        ).finally(() => {
          ready = true;
        });
      }

      return active;
    };
  });

  return state[0](...args);
};
