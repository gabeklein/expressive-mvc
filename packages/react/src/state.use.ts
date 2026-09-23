import { State, Context } from '@expressive/mvc';
import type { UseState } from '@expressive/mvc';
import { useFactory, useWatch } from './runtime';

declare module '@expressive/mvc' {
  interface UseState extends State {
    /**
     * Optional hook called when State.use() is invoked within a React component.
     *
     * This is called *every render* of the component, and will intercept
     * arguments which would otherwise be passed into the State constructor.
     *
     * @param props Arguments passed to State.use().
     */
    use?(...props: any[]): Promise<void> | void;

    /**
     * Optional hook called once the host component commits. Return a function
     * to run when it unmounts.
     *
     * Not called during server render, nor for an instance merely observed or
     * placed: `.get()` and `{instance}` reach one a component does not own, and
     * `State.new()` has no component at all.
     *
     * Client-only effects belong here - setup which must accompany the instance
     * itself belongs in `new()`.
     */
    mount?(): (() => void) | void;
  }

  namespace State {
    type UseArgs<T extends State> = T extends {
      use(...props: infer P): any;
    }
      ? P
      : State.Args<T>;

    /**
     * Create and manage instance of this State within React component.
     *
     * @param args Arguments to pass to constructor or `use` method (if defined).
     * @returns Managed instance of this State.
     */
    function use<T extends UseState>(
      this: State.Type<T>,
      ...args: UseArgs<T>
    ): T;
  }
}

State.use = function use<T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  const outer = Context.get();
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
