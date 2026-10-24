import { Model } from '@expressive/mvc';
import type { UseModel } from '@expressive/mvc';
import { useAmbient } from './context';
import { useFactory, useWatch } from './runtime';

declare module '@expressive/mvc' {
  interface UseModel extends Model {
    /**
     * Optional hook called when Model.use() is invoked within a React component.
     *
     * This is called *every render* of the component, and will intercept
     * arguments which would otherwise be passed into the Model constructor.
     *
     * @param props Arguments passed to Model.use().
     */
    use?(...props: any[]): Promise<void> | void;

    /**
     * Optional hook called once the host component commits. Return a function
     * to run when it unmounts.
     *
     * Not called during server render, nor for an instance merely observed or
     * placed: `.get()` and `{instance}` reach one a component does not own, and
     * `Model.new()` has no component at all.
     *
     * Client-only effects belong here - setup which must accompany the instance
     * itself belongs in `new()`.
     */
    mount?(): (() => void) | void;
  }

  namespace Model {
    type UseArgs<T extends Model> = T extends {
      use(...props: infer P): any;
    }
      ? P
      : Model.Args<T>;

    /**
     * Create and manage instance of this Model within React component.
     *
     * @param args Arguments to pass to constructor or `use` method (if defined).
     * @returns Managed instance of this Model.
     */
    function use<T extends UseModel>(
      this: Model.Type<T>,
      ...args: UseArgs<T>
    ): T;
  }
}

Model.use = function use<T extends Model>(
  this: Model.Type<T>,
  ...args: Model.UseArgs<T>
) {
  const outer = useAmbient();
  const render = useFactory(() => {
    const add = (arg: unknown) =>
      typeof arg == 'object' && instance.set(arg as Model.Assign<T>);

    let use = (...args: Model.Args<T>) => Promise.all(args.flat().map(add));

    const instance = new this((x) => {
      if ('use' in x && typeof x.use == 'function') {
        use = x.use.bind(x);
        use(...args);
      }
      else return args;
    });

    const context = outer.push(instance);
    const teardown = () => {
      context.pop();
      instance.set(null);
    };

    let ready = false;

    return (args: Model.Args<T>) => {
      if (ready) {
        ready = false;
        Promise.resolve(use(...args)).finally(() => {
          ready = true;
        });
      }

      return useWatch(instance, () => {
        ready = true;
        return (instance as UseModel).mount?.();
      }, teardown);
    };
  });

  return render(args);
};
