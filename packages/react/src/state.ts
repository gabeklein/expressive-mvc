import { State, Context, watch } from '@expressive/state';

export const Pragma = {} as {
  createElement(type: any, props?: any, ...children: any[]): any;
  useState<S>(initial: S): [S, (next: (previous: S) => S) => void];
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

State.use = function <T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  const outer = Context.get();
  const ref = Pragma.useRef<((args: State.Args<T>) => T) | null>(null);
  const next = Pragma.useState(0)[1];

  if (!ref.current) ref.current = init(this);

  return ref.current(args);

  function init(Type: State.Type<T>) {
    const add = (arg: unknown) =>
      typeof arg == 'object' && instance.set(arg as State.Assign<T>);

    let use = (...args: State.Args<T>) => Promise.all(args.flat().map(add));

    const instance = new Type((x) => {
      if (x instanceof State && 'use' in x && typeof x.use == 'function') {
        (use = x.use.bind(x))(...args);
      } else {
        return args;
      }
    });

    const context = outer.push(instance);

    let mounts = 0;
    let mounted = false;
    let active: T;

    watch(instance, (current) => {
      active = current;

      if (mounted) next((x) => x + 1);
    });

    return (args: State.Args<T>) => {
      Pragma.useState(() => mounts++);
      Pragma.useEffect(() => {
        mounted = true;
        return () => {
          if (--mounts) return;
          context.pop();
          instance.set(null);
        };
      }, []);

      if (mounted) {
        mounted = false;

        Promise.resolve(use(...args)).finally(() => (mounted = true));
      }

      return active;
    };
  }
};

State.get = function <T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  const ref = Pragma.useRef<(() => any) | null>(null);
  const next = Pragma.useState(0)[1];
  const context = Context.get();

  if (!ref.current) ref.current = init(this);

  return ref.current();

  function init(Type: State.Extends<T>) {
    let instance: T | undefined;
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
      unwatch?.();
      unsubscribe();
      unwatch = undefined;
      instance = undefined;
    }

    const unsubscribe = context.get(Type, (next) => {
      unwatch?.();
      unwatch = watch(
        (instance = next),
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
    });

    if (!instance) {
      release();
      if (argument === false) return () => undefined;
      throw new Error(`Could not find ${Type} in context.`);
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

    if (value === null) {
      release();
      return () => null;
    }

    let mounts = 0;

    return () => {
      Pragma.useState(() => mounts++);

      pending = false;
      Pragma.useEffect(() => {
        mounted = true;
        return () => {
          if (!--mounts) release();
        };
      }, []);
      return value === undefined ? null : value;
    };
  }
};

export { State };
