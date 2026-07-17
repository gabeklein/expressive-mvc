import { State, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import {
  prepare,
  start,
  useCommit,
  useFactory,
  useHook,
  useReady
} from './runtime';

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

    const context = outer.push();
    context.add(instance, true);
    prepare(instance);
    const guarded = new WeakMap<object, object>();

    function guard<S extends object>(state: S): S {
      const found = guarded.get(state);
      if (found) return found as S;

      const proxy = new Proxy(state, {
        get(target, key, receiver) {
          try {
            const value = Reflect.get(target, key, receiver);

            if (
              key !== 'is' &&
              value &&
              (typeof value === 'object' || typeof value === 'function') &&
              observer(value) !== undefined
            ) return guard(value);

            return value;
          } catch (error) {
            if (
              error &&
              (typeof error === 'object' || typeof error === 'function') &&
              typeof (error as PromiseLike<unknown>).then === 'function'
            ) throw Object.assign(new Error(
              'State.use() cannot suspend. Resolve async values before creating local State or read them from context with State.get().'
            ), { cause: error });

            throw error;
          }
        }
      });

      guarded.set(state, proxy);
      return proxy;
    }

    let ready = false;

    return (args: State.Args<T>) => {
      if (ready) {
        ready = false;
        Promise.resolve(use(...args)).finally(() => {
          ready = true;
        });
      }

      useReady(() => ready = true);

      const current = useHook<T>((update) => {
        watch(instance, update);
        return () => {
          context.pop();
          instance.set(null);
        };
      });

      useCommit(() => start(instance));

      return guard(current);
    };
  });

  return render(args);
};
