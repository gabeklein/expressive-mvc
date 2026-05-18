import { State, Observable, watch } from '@expressive/state';
import { Runtime, useFactory, useHook, useReady } from './runtime';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

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

declare namespace use {
  type GetFactory<T extends object, R> = (
    this: T,
    current: T,
    refresh: ForceRefresh
  ) => R;

  type GetEffect<T extends object> = (
    this: T,
    current: T,
    refresh: ForceRefresh
  ) => null;
}

declare namespace Observe {
  type Argument<T extends object> = true | use.GetFactory<T, unknown>;
}

type Mode = 'factory' | 'required' | 'proxy';

function mode<T extends object>(argument: Observe.Argument<T> | undefined) {
  return argument === true
    ? 'required'
    : typeof argument == 'function'
      ? 'factory'
      : 'proxy';
}

function isObservable(target: object) {
  return target instanceof State || Observable in target;
}

/**
 * Subscribe to an observable object by reference.
 *
 * Returns a tracking proxy. Values accessed during render will refresh the
 * component when they change.
 */
function use<T extends object>(target: T): T;
function use<T extends object>(target: T | null | undefined): T | undefined;
function use<T extends object>(target: T, requireValues: true): Required<T>;
function use<T extends object>(
  target: T | null | undefined,
  requireValues: true
): Required<T> | undefined;
function use<T extends object, R>(
  target: T,
  factory: use.GetFactory<T, Promise<R> | R>
): NoVoid<R>;
function use<T extends object, R>(
  target: T | null | undefined,
  factory: use.GetFactory<T, Promise<R> | R>
): NoVoid<R> | undefined;
function use<T extends object>(target: T, factory: use.GetEffect<T>): null;
function use<T extends object>(
  target: T | null | undefined,
  factory: use.GetEffect<T>
): null | undefined;
function use<T extends object>(
  target: T | null | undefined,
  input?: Observe.Argument<T>
) {
  const next = Runtime.useState(0)[1];
  const render = useFactory(() => {
    let argument: Observe.Argument<T> | undefined;
    let current: T | undefined;
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let attaching = false;
    let initialized = false;
    let version = 0;
    let value: any;
    let error: unknown;
    let hasError = false;
    let currentMode: Mode = 'proxy';

    function update() {
      next((x) => x + 1);
    }

    function refresh<T>(action?: Promise<T> | (() => Promise<T>)): any {
      if (typeof action == 'function') action = action();
      update();
      if (action instanceof Promise) return action.finally(update);
    }

    function detach() {
      unwatch?.();
      unwatch = undefined;
    }

    function release() {
      detach();
      current = undefined;
      initialized = false;
      value = undefined;
      error = undefined;
      hasError = false;
      version++;
    }

    function attach(target: T, nextArgument: Observe.Argument<T> | undefined) {
      const nextMode = mode(nextArgument);

      if (target === current && nextMode === currentMode) {
        argument = nextArgument;
        return;
      }

      detach();
      argument = nextArgument;
      current = target;
      currentMode = nextMode;
      initialized = false;
      value = undefined;
      error = undefined;
      hasError = false;
      version++;

      attaching = true;
      unwatch = watch(
        target,
        (current, changed) => {
          if (typeof argument == 'function') {
            const next = argument.call(current, current, refresh);
            if (initialized && next === value) return;
            value = next;
          } else {
            value = current;
          }

          if (initialized) {
            update();
          } else {
            initialized = true;
            if (mounted && !attaching) update();
          }
        },
        argument === true
      );
      attaching = false;
    }

    function output() {
      if (hasError) throw error;

      if (value === null) {
        detach();
        return null;
      }

      if (value instanceof Promise) {
        const waiting = value;
        const active = version;

        detach();

        waiting
          .then(
            (x) => {
              if (active === version) value = x;
            },
            (e) => {
              if (active === version) {
                error = e;
                hasError = true;
              }
            }
          )
          .finally(() => {
            if (active === version) update();
          });

        value = null;
        return null;
      }

      return value === undefined ? null : value;
    }

    return (target: T | null | undefined, argument?: Observe.Argument<T>) => {
      let thrown: unknown;
      let hasThrown = false;
      let shouldRead = false;
      let value: any;

      if (target == null) {
        release();
        value = undefined;
      } else if (!isObservable(target)) {
        release();
        thrown = new TypeError('use() expects a State or Observable object.');
        hasThrown = true;
      } else {
        attach(target, argument);
        shouldRead = true;
      }

      useReady(() => (mounted = true));
      useHook(() => release);

      if (hasThrown) throw thrown;

      return shouldRead ? output() : value;
    };
  });

  return render(target, input);
}

export { use };
