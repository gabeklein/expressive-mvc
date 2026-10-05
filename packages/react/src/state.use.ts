import { State } from '@expressive/mvc';
import type { UseState } from '@expressive/mvc';
import { Runtime, useFactory, useWatch } from './runtime';
import { Context, useAmbient } from './context';

const create = State.use;

State.use = function use<T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  let outer: Context;

  if (Runtime.idle()) return (create as Function).apply(this, args);

  try {
    outer = useAmbient();
  } catch {
    return (create as Function).apply(this, args);
  }

  const render = useFactory(() => {
    if (outer.get(this, false) !== undefined)
      throw new Error(
        `${this} is already in context - nest a <Component for={${this}}> to scope another, or call ${this}.get() to read it.`
      );

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
