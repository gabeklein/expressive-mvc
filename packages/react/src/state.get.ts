import { Model, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import { useAmbient } from './context';
import { Runtime, useFactory, useSettle, useSetup, useWeak } from './runtime';

const forward = Context.get as (...args: unknown[]) => unknown;

Context.get = ((
  arg?: Model | Model.Extends,
  compute?: (context: Context) => unknown,
  required?: boolean
) => {
  if (Context.current || (arg && !compute)) return forward(arg, compute, required);

  if (!compute)
    try {
      return useAmbient();
    } catch {
      return forward();
    }

  return use(arg as Model.Extends, compute, required);
}) as typeof Context.get;

function use(
  Type: Model.Extends,
  compute: (context: Context) => unknown,
  required?: boolean
) {
  const [tick, next] = Runtime.useState(0);
  const claim = useSettle(tick);
  const local = useAmbient();
  const dispatch = useWeak(next);
  const hook = useFactory(() => {
    let mounted = false;
    let pending = false;
    let force!: () => void;
    let context: Context | undefined;
    let target: unknown;
    let value: unknown;
    let unwatch: (() => void) | undefined;
    let unsubscribe: (() => void) | undefined;

    function update() {
      pending = false;
      dispatch.deref()!((x) => x + 1);
    }

    function observed() {
      if (mounted) {
        claim();
        update();
      }
      else pending = true;
    }

    function subscribe(next: Context) {
      if (context === next) return;

      let ready = false;

      unsubscribe?.();
      context = next;
      unsubscribe = next.get(Type, () => {
        if (!ready) return;

        pending = true;

        if (mounted) queueMicrotask(() => pending && update());
      }, false);

      ready = true;
    }

    function attach(found: unknown) {
      if (found === target) return;

      unwatch?.();
      unwatch = undefined;
      target = value = found;

      if (!(found instanceof Model) || observer(found) === null) return;

      let first = true;

      unwatch = watch(
        found,
        (current) => {
          value = current;

          if (!first) observed();
          first = false;

          return (update) => {
            if (update === true) force();
          };
        },
        required,
        Runtime.startTransition
      );
    }

    function release() {
      unsubscribe?.();
      unwatch?.();
      unsubscribe = unwatch = context = target = undefined;
    }

    return {
      render(found: unknown) {
        pending = false;
        attach(found);
        useSetup((_self, reset) => {
          force = reset;

          return () => {
            mounted = true;
            if (pending) update();
            return release;
          };
        });
        return value;
      },
      subscribe
    };
  });

  hook.subscribe(local);

  return hook.render(compute(local));
}
