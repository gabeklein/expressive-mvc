import { Model, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import { resolver } from '@expressive/mvc/jsx-runtime';
import { useAmbient } from './context';
import { Runtime, useFactory, useSettle, useSetup, useWeak } from './runtime';

const normal = resolver((Type, compute) => {
  const idle = Runtime.idle();

  if (idle) return normal(Type, compute);

  let ambient: Context;

  if (idle === undefined)
    try {
      ambient = useAmbient();
    } catch {
      return normal(Type, compute);
    }
  else ambient = useAmbient();

  return Type ? use(ambient, compute) : compute(ambient);
});

function use(local: Context, compute: (context: Context) => unknown) {
  const [tick, next] = Runtime.useState(0);
  const claim = useSettle(tick);
  const dispatch = useWeak(next);
  const render = useFactory(() => {
    let latest = compute;
    let mounted = false;
    let pending = false;
    let force!: () => void;
    let target: unknown;
    let value: unknown;
    let unwatch: (() => void) | undefined;
    let thrown: [unknown] | undefined;

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

    function follow(found: unknown) {
      if (found === target) return;

      unwatch?.();
      unwatch = undefined;
      target = value = found;

      if (found instanceof Model && observer(found) !== null) {
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
          false,
          Runtime.startTransition
        );
      }

      return true;
    }

    function release() {
      unfollow();
      unwatch?.();
      unwatch = target = undefined;
    }

    let first = true;

    const unfollow = watch(local, (ctx) => {
      try {
        if (follow(latest(ctx)) && !first) observed();
      } catch (error) {
        thrown = [error];
        if (!first) observed();
      }
    }, false);

    first = false;

    if (thrown) {
      unfollow();
      throw thrown[0];
    }

    let fresh = true;

    return (next: typeof compute) => {
      pending = false;
      useSetup((_self, reset) => {
        force = reset;

        return () => {
          mounted = true;
          if (pending) update();
          return release;
        };
      });

      if (!fresh) follow((latest = next)(local));

      fresh = false;

      return value;
    };
  });

  return render(compute);
}
