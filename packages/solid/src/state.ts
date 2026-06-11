import { State, listener, watch } from '@expressive/mvc';
import {
  Accessor,
  Signal,
  createSignal,
  onCleanup,
  useContext
} from 'solid-js';

import { Lookup } from './context';

/** Type may not be undefined - instead will be null. */
type NoVoid<T> = T extends undefined | void ? null : T;

declare module '@expressive/mvc' {
  interface UseState extends State {
    /**
     * Optional hook called when State.use() is invoked within a Solid component.
     *
     * Unlike React, Solid components run setup only once, so this is called a
     * single time and will intercept arguments which would otherwise be passed
     * into the State constructor.
     *
     * @param props Arguments passed to State.use().
     */
    use?(...props: any[]): Promise<void> | void;
  }

  namespace State {
    /**
     * Reactive proxy over a State instance. All non-function properties are
     * replaced by Solid signal accessors; methods and `is` pass through as-is.
     */
    type Reactive<T extends State> = {
      [P in keyof T]: P extends keyof State
        ? T[P]
        : T[P] extends (...args: any[]) => any
          ? T[P]
          : Accessor<T[P]>;
    };

    type ForceRefresh = {
      /** Notify subscribers of the returned accessor. */
      (): void;

      /**
       * Notify subscribers and again after promise either resolves or rejects.
       *
       * @param waitFor Promise to wait for.
       * @returns Promise which resolves, after refresh, to same value as `waitFor`.
       */
      <T = void>(waitFor: Promise<T>): Promise<T>;

      /**
       * Notify subscribers before and after async function.
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
     * Create and manage an instance of this State within a Solid component.
     *
     * The instance is pushed onto ambient context, so `get()` instructions
     * within may resolve parent and peer states. It is destroyed on cleanup.
     *
     * @param args Arguments to pass to constructor or `use` method (if defined).
     * @returns Reactive proxy for managed instance of this State.
     */
    function use<T extends UseState>(
      this: State.Type<T>,
      ...args: UseArgs<T>
    ): Reactive<T>;

    /** Fetch instance of this class from context. Throws if not found. */
    function get<T extends State>(this: State.Extends<T>): Reactive<T>;

    /** Fetch instance of this class optionally. */
    function get<T extends State>(
      this: State.Extends<T>,
      required: false
    ): Reactive<T> | undefined;

    /**
     * Fetch instance of this class from context.
     * Accessors will throw if a value they refer to is undefined.
     */
    function get<T extends State>(
      this: State.Extends<T>,
      requireValues: true
    ): Reactive<Required<T>>;

    /**
     * Compute a value from instance of this class found in context.
     * Factory is run again (and accessor subscribers notified) when
     * any accessed properties update.
     *
     * If factory returns a promise, accessor will return null until it
     * settles - then the resolved value, or throw the rejection reason.
     */
    function get<T extends State, R>(
      this: State.Extends<T>,
      factory: GetFactory<T, Promise<R> | R>
    ): Accessor<NoVoid<R>>;

    /**
     * Run an effect against instance of this class found in context.
     * Returning null stops the effect from re-running.
     */
    function get<T extends State>(
      this: State.Extends<T>,
      factory: GetEffect<T>
    ): Accessor<null>;
  }
}

const PROXY = new WeakMap<object, State.Reactive<any>>();
const REQUIRED = new WeakMap<object, State.Reactive<any>>();
const SIGNALS = new WeakMap<object, Map<string, Signal<unknown>>>();

/**
 * Reactive proxy for any observable instance, where non-function properties
 * are served as Solid signal accessors.
 *
 * One proxy and one update listener exist per instance - repeat calls return
 * the cached proxy. The listener detaches automatically when the instance is
 * destroyed; caches are weakly held, so neither will leak.
 */
function signalProxy<T extends State>(
  from: T,
  requireValues?: boolean
): State.Reactive<T> {
  const subject = (from.is || from) as T;
  const cache = requireValues ? REQUIRED : PROXY;
  const cached = cache.get(subject);

  if (cached) return cached;

  let signals = SIGNALS.get(subject);

  if (!signals) {
    const update = signals = new Map<string, Signal<unknown>>();

    SIGNALS.set(subject, signals);

    listener(subject, (key) => {
      if (key === null) return null;

      if (typeof key === 'boolean') return;

      const signal = update.get(key as string);

      if (signal) signal[1](() => (subject as any)[key]);
    });
  }

  const required = requireValues
    ? new Map<string, Accessor<unknown>>()
    : undefined;

  const proxy = new Proxy(subject, {
    get(target: any, prop: string | symbol) {
      const value = target[prop];

      if (
        typeof value === 'function' ||
        typeof prop === 'symbol' ||
        prop === 'is'
      )
        return value;

      let signal = signals!.get(prop);

      if (!signal) {
        signal = createSignal(value, { equals: false });
        signals!.set(prop, signal);
      }

      if (!required) return signal[0];

      let accessor = required.get(prop);

      if (!accessor) {
        const read = signal[0];

        accessor = () => {
          const current = read();

          if (current === undefined)
            throw new Error(`${target}.${prop} is required in this context.`);

          return current;
        };

        required.set(prop, accessor);
      }

      return accessor;
    }
  }) as State.Reactive<T>;

  cache.set(subject, proxy);

  return proxy;
}

State.use = function use<T extends State>(
  this: State.Type<T>,
  ...args: State.UseArgs<T>
) {
  const ambient = useContext(Lookup);

  const instance: T = new this((x: any) => {
    if ('use' in x && typeof x.use === 'function') x.use(...args);
    else return args;
  });

  const context = ambient.push(instance);

  onCleanup(() => {
    context.pop();
    instance.set(null);
  });

  return signalProxy(instance);
};

State.get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
): any {
  const context = useContext(Lookup);

  if (typeof argument !== 'function') {
    const instance = context.get(this, argument);

    return instance ? signalProxy(instance, argument === true) : undefined;
  }

  const instance = context.get(this) as T;
  const [signal, setSignal] = createSignal(undefined, { equals: false });

  let value: any;
  let error: Error | undefined;

  function refresh<R>(action?: Promise<R> | (() => Promise<R>)): any {
    if (typeof action === 'function') action = action();

    setSignal(undefined);

    if (action instanceof Promise)
      return action.finally(() => setSignal(undefined));
  }

  const release = watch(instance, (current, changed) => {
    const next = argument.call(current, current, refresh);

    if (next === value) return;

    value = next;

    if (changed.length) setSignal(undefined);
  });

  if (value === null) {
    release();
    return () => null;
  }

  if (value instanceof Promise) {
    release();

    value
      .then(
        (x) => (value = x),
        (e) => (error = e)
      )
      .finally(() => setSignal(undefined));

    value = null;

    return () => {
      signal();

      if (error) throw error;

      return value === undefined ? null : value;
    };
  }

  onCleanup(release);

  return () => {
    signal();
    return value === undefined ? null : value;
  };
};

export { State, signalProxy };
