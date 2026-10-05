import { State } from '@expressive/mvc';
import type { UseState } from '@expressive/mvc';
import { useFactory, useWatch } from './runtime';
import { useAmbient } from './context';

State.use = function use<T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  const outer = useAmbient();
  const render = useFactory(() => {
    const add = (arg: unknown) =>
      typeof arg == 'object' && instance.set(arg as State.Assign<T>);

    let use = (...args: State.Args<T>) => Promise.all(args.flat().map(add));

    const instance = new this((x) => {
      if ('use' in x && typeof x.use == 'function') {
        use = x.use.bind(x);
        use(...args);
      }
      else return args;
    });

    const context = outer.push(instance);

    let ready = false;

    return (args: State.Args<T>) => {
      if (ready) {
        ready = false;
        Promise.resolve(use(...args)).finally(() => {
          ready = true;
        });
      }

      return useWatch(instance, () => {
        ready = true;

        const release = (instance as UseState).mount?.();

        return () => {
          if (typeof release == 'function') release();
          context.pop();
          instance.set(null);
        };
      });
    };
  });

  return render(args);
};
