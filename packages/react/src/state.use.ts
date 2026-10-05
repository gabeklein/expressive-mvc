import { State } from '@expressive/mvc';
import type { UseState } from '@expressive/mvc';
import { Runtime, useFactory, useWatch } from './runtime';
import { Context, useAmbient } from './context';

const create = State.use;

function outside(type: State.Type, args: unknown[]) {
  // React calls components outside a render to locate stack frames; it expects a throw, not an instance.
  if (String(new Error().stack).includes('DetermineComponentFrameRoot'))
    throw new Error(`${type}.use() outside a render.`);

  return (create as Function).apply(type, args);
}

State.use = function use<T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  let outer: Context;

  if (Runtime.idle()) return outside(this, args);

  try {
    outer = useAmbient();
  } catch {
    return outside(this, args);
  }

  const render = useFactory(() => {
    for (let T: State.Extends = this; T !== State; T = Object.getPrototypeOf(T)) {
      const found = outer.get(T, false);

      if (T === this ? found !== undefined : found?.constructor === T)
        throw new Error(
          `${T} is already in context - nest a <Component for={${this}}> to scope another, or call ${T}.get() to read it.`
        );
    }

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
