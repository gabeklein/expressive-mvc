import { State, Context, watch } from '@expressive/state';
import { Runtime, useFactory, useHook, useReady } from './runtime';

export { Runtime };

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

type ObservableRefresh = {
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

type ObservableFactory<T extends object, R> = (
  this: T,
  current: T,
  refresh: ObservableRefresh
) => R;

type ObservableEffect<T extends object> = (
  this: T,
  current: T,
  refresh: ObservableRefresh
) => null;

type ObservableArgument<T extends object> =
  | boolean
  | ObservableFactory<T, unknown>;

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
    type ForceRefresh = ObservableRefresh;

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

declare namespace use {
  export type Factory<T extends object, R> = ObservableFactory<T, R>;
  export type Effect<T extends object> = ObservableEffect<T>;
}

function observe<T extends object>(
  target: T,
  argument: ObservableArgument<T> | undefined,
  refresh: ObservableRefresh,
  update: () => void,
  getValue: () => unknown,
  setValue: (next: unknown) => void
) {
  return watch(
    target,
    (current, changed) => {
      if (typeof argument === 'function') {
        const next = argument.call(current, current, refresh);
        if (next === getValue()) return;
        setValue(next);
      } else {
        setValue(current);
      }

      if (changed.length) update();
    },
    argument === true
  );
}

function refresh<T>(
  update: () => void,
  action?: Promise<T> | (() => Promise<T>)
): any {
  if (typeof action == 'function') action = action();
  update();
  if (action instanceof Promise) return action.finally(update);
}

function output(
  getValue: () => any,
  setValue: (next: unknown) => void,
  getError: () => unknown,
  setError: (next: unknown) => void,
  release: () => void,
  update: () => void
) {
  let value = getValue();

  if (value instanceof Promise) {
    setError(undefined);
    release();

    value
      .then(
        (next) => setValue(next),
        (error) => setError(error)
      )
      .finally(update);

    setValue(value = null);
  }

  const error = getError();
  if (error) throw error;

  if (value === null) release();

  return value === undefined ? null : value;
}

function useCleanup(release: () => void, ready: () => void) {
  useReady(ready);
  useHook(() => release);
}

function use<T extends object>(target: T): T;
function use<T extends object>(target: T, requireValues: true): Required<T>;
function use<T extends object, R>(
  target: T,
  factory: use.Factory<T, Promise<R> | R>
): NoVoid<R>;
function use<T extends object>(
  target: T,
  factory: use.Effect<T>
): null;
function use<T extends object>(
  target: T,
  argument?: true | use.Factory<T, unknown>
) {
  const next = Runtime.useState(0)[1];
  const render = useFactory(() => {
    let current: T | undefined;
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let error: unknown;
    let value: unknown;

    function update() {
      pending = false;
      next((x) => x + 1);
    }

    const force: ObservableRefresh = (action?: any) => refresh(update, action);

    function release() {
      unwatch?.();
      unwatch = undefined;
    }

    function attach(target: T, notify = true) {
      error = undefined;
      value = undefined;
      release();
      unwatch = observe(
        target,
        argument,
        force,
        update,
        () => value,
        (next) => value = next
      );

      if (notify && mounted) {
        pending = true;
        queueMicrotask(() => pending && update());
      }
    }

    return (target: T) => {
      if (current !== target) {
        current = target;
        attach(target, false);
      }

      pending = false;
      useCleanup(release, () => mounted = true);
      return output(
        () => value,
        (next) => value = next,
        () => error,
        (next) => error = next,
        release,
        update
      );
    };
  });

  return render(target);
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

      useReady(() => ready = true);

      return useHook<T>((update) => {
        watch(instance, update);
        return () => {
          context.pop();
          instance.set(null);
        };
      });
    };
  });

  return render(args);
};

State.get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  const next = Runtime.useState(0)[1];
  const local = Context.get();
  const render = useFactory(() => {
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let error: unknown;
    let value: unknown;

    function update() {
      pending = false;
      next((x) => x + 1);
    }

    const factory = argument === false ? undefined : argument;
    const force: ObservableRefresh = (action?: any) => refresh(update, action);

    function unobserve() {
      unwatch?.();
      unwatch = undefined;
    }

    function attach(next: T) {
      error = undefined;
      value = undefined;
      unobserve();
      unwatch = observe(
        next,
        factory,
        force,
        update,
        () => value,
        (next) => value = next
      );

      if (mounted) {
        pending = true;
        queueMicrotask(() => pending && update());
      }

      return release;
    }

    const unsubscribe = local.get(this, attach);

    function release() {
      unsubscribe();
      unobserve();
    }

    if (!unwatch) {
      unsubscribe();
      if (argument === false) return () => undefined;
      throw new Error(`Could not find ${this} in context.`);
    }

    return () => {
      pending = false;
      useCleanup(release, () => mounted = true);
      return output(
        () => value,
        (next) => value = next,
        () => error,
        (next) => error = next,
        release,
        update
      );
    };
  });

  return render();
};

export { State, use };
