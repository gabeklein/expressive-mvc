import { State, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import { Runtime, useFactory, useSettle, useSetup } from './runtime';
import { useAmbient } from './context';

const resolve = State.get;

State.get = function get<T extends State>(
  this: State.Extends<T>,
  argument?: boolean | State.GetFactory<T, unknown>
) {
  let local: Context;

  try {
    local = useAmbient();
  } catch {
    return (resolve as Function).call(this, argument);
  }

  const Type = this;
  const [tick, next] = Runtime.useState(0);
  const claim = useSettle(tick);
  const render = useFactory(() => {
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let value: any;
    let force!: () => void;

    function update() {
      pending = false;
      next((x) => x + 1);
    }

    function observed() {
      if (mounted) {
        claim();
        update();
      }
      else pending = true;
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
      if (local.get(Type, false) !== next) return;

      unwatch?.();

      if (observer(next) === null) {
        value = typeof argument === 'function'
          ? argument.call(next, next, refresh)
          : next;
        unwatch = () => {};
        return release;
      }

      let first = true;

      unwatch = watch(
        next,
        (current) => {
          if (typeof argument === 'function') {
            const next = argument.call(current, current, refresh);
            if (next === value) return;
            value = next;
          } else {
            value = current;
          }

          if (!first) observed();
          first = false;

          return (update) => {
            if (update === true) force();
          };
        },
        argument === true,
        Runtime.startTransition
      );

      if (mounted) {
        pending = true;
        queueMicrotask(() => pending && update());
      }

      return release;
    }

    const unsubscribe = local.get(Type, attach);

    if (!unwatch) {
      unsubscribe();
      if (argument === false) return () => undefined;
      throw new Error(`Could not find ${Type} in context.`);
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
      useSetup((_self, reset) => {
        force = reset;

        return () => {
          mounted = true;
          if (pending) update();
          return release;
        };
      });
      return value === undefined ? null : value;
    };
  });

  return render();
};
