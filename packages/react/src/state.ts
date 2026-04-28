import { State, Context, watch } from '@expressive/state';

export const Pragma = {} as {
  createElement(type: any, props?: any, ...children: any[]): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
};

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/state' {
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
    type ForceRefresh = {
      /** Request a refresh for current component. */
      (): void;

      /**
       * Request a refresh and again after promise either resolves or rejects.
       *
       * @param waitFor Promise to wait for.
       * @returns Promise which resolves, after refresh, to same value as `waitFor`.
       */
      <T = void>(waitFor: Promise<T>): Promise<T>;

      /**
       * Request refresh before and after async function.
       * A refresh will occur both before and after the given function.
       *
       * **Note:** Any actions performed before first `await` will occur prior to refresh.
       *
       * @param invoke Async function to invoke.
       * @returns Promise which resolves returned value after refresh.
       */
      <T = void>(invoke: () => Promise<T>): Promise<T>;
    };

    type GetFactory<T extends State, R> = (
      this: T,
      current: T,
      refresh: ForceRefresh
    ) => R;

    type GetEffect<T extends State> = (
      this: T,
      current: T,
      refresh: ForceRefresh
    ) => null;

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

    /** Fetch instance of this class from context. */
    function get<T extends State>(this: State.Extends<T>): T;

    /** Fetch instance of this class optionally. */
    function get<T extends State>(
      this: State.Extends<T>,
      required: false
    ): T | undefined;

    /** Fetch instance of this class from context. */
    function get<T extends State>(
      this: State.Extends<T>,
      requireValues: true
    ): Required<T>;

    function get<T extends State, R>(
      this: State.Extends<T>,
      factory: GetFactory<T, Promise<R> | R>
    ): NoVoid<R>;

    function get<T extends State>(
      this: State.Extends<T>,
      factory: GetEffect<T>
    ): null;
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
    let active: T;

    return (args: State.Args<T>) => {
      if (ready) {
        ready = false;
        Promise.resolve(use(...args)).finally(() => {
          ready = true;
        });
      }

      Pragma.useEffect(() => {
        ready = true;
      }, []);

      useMount((refresh) => {
        watch(instance, (current) => {
          active = current;
          if (ready) refresh();
        });

        return () => {
          context.pop();
          instance.set(null);
        };
      });

      return active;
    };
  });

  return render(args);
};

State.get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  const next = Pragma.useState(0)[1];
  const local = Context.get();
  const render = useFactory(() => {
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let value: any;

    function update() {
      pending = false;
      next((x) => x + 1);
    }

    function refresh<T>(action?: Promise<T> | (() => Promise<T>)): any {
      if (typeof action == 'function') action = action();
      update();
      if (action instanceof Promise) return action.finally(update);
    }

    function release() {
      unsubscribe();
      unwatch?.();
      unwatch = undefined;
    }

    function attach(next: T) {
      unwatch?.();
      unwatch = watch(
        next,
        (current, changed) => {
          if (typeof argument === 'function') {
            const next = argument.call(current, current, refresh);
            if (next === value) return;
            value = next;
          } else {
            value = current;
          }

          if (changed.length) update();
        },
        argument === true
      );

      if (mounted) {
        pending = true;
        queueMicrotask(() => pending && update());
      }

      return release;
    }

    const unsubscribe = local.get(this, attach);

    if (!unwatch) {
      unsubscribe();
      if (argument === false) return () => undefined;
      throw new Error(`Could not find ${this} in context.`);
    }

    if (value === null) {
      release();
      return () => null;
    }

    if (value instanceof Promise) {
      let error: Error | undefined;

      release();

      value
        .then(
          (x) => (value = x),
          (e) => (error = e)
        )
        .finally(update);

      value = null;

      return () => {
        if (error) throw error;
        return value === undefined ? null : value;
      };
    }

    return () => {
      pending = false;
      Pragma.useEffect(() => {
        mounted = true;
      }, []);
      useMount(() => release);
      return value === undefined ? null : value;
    };
  });

  return render();
};

function useFactory<T extends Function>(factory: () => T) {
  const ref = Pragma.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
}

/**
 * useEffect which tolerates react StrictMode double-invoking effects on mount.
 */
export function useMount(
  callback: (refresh: () => void) => () => void
) {
  const { current } = Pragma.useRef(
    { mounted: 0 } as {
      mounted: number;
      unmount: () => void;
      update: (next: (previous: number) => number) => void;
    }
  );

  current.update = Pragma.useState(() => {
    if (!current.mounted)
      current.unmount = callback(() => {
        current.update?.((x) => x + 1);
      });

    return current.mounted++;
  })[1];

  Pragma.useEffect(() => () => {
    if (--current.mounted < 1) current.unmount();
  }, []);
}

export { State };
