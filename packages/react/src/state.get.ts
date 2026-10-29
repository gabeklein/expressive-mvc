import { Model, Context } from '@expressive/mvc';
import { observer, watch } from '@expressive/mvc/observable';
import { Runtime, useFactory, useSettle, useSetup, useWeak } from './runtime';

declare module '@expressive/mvc' {
  namespace Model {
    /** Fetch instance of this class from context. */
    function get<T extends Model>(this: Model.Extends<T>): T;

    /** Fetch instance of this class optionally. */
    function get<T extends Model>(
      this: Model.Extends<T>,
      required: false
    ): T | undefined;

    /** Fetch instance of this class from context. */
    function get<T extends Model>(
      this: Model.Extends<T>,
      requireValues: true
    ): Required<T>;
  }
}

Model.get = function get<T extends Model>(
  this: Model.Extends<T>,
  argument?: boolean
) {
  const Type = this;
  const [tick, next] = Runtime.useState(0);
  const claim = useSettle(tick);
  const local = Context.get();
  const dispatch = useWeak(next);
  const render = useFactory(() => {
    let unwatch: (() => void) | undefined;
    let mounted = false;
    let pending = false;
    let value: any;
    let force!: () => void;

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

    function release() {
      unfollow();
      unwatch?.();
      unwatch = undefined;
    }

    function attach(next: T) {
      unwatch?.();

      if (observer(next) === null) {
        value = next;
        unwatch = () => {};
        return;
      }

      let first = true;

      unwatch = watch(
        next,
        (current) => {
          value = current;

          if (!first) observed();
          first = false;

          return (update) => {
            if (update === true) force();
          };
        },
        argument === true,
        Runtime.startTransition
      );
    }

    let found: T | undefined;

    function follow(next: T | undefined) {
      if (next === found) return;

      found = next;
      unwatch?.();
      unwatch = undefined;
      value = undefined;

      if (next) attach(next);

      return true;
    }

    const unfollow = watch(local, (ctx) => {
      if (follow(ctx.get(Type, false)) && mounted) observed();
    }, false);

    if (!found && argument !== false) {
      unfollow();
      throw new Error(`Could not find ${Type} in context.`);
    }

    return () => {
      follow(local.get(Type, false));
      pending = false;
      useSetup((_self, reset) => {
        force = reset;

        return () => {
          mounted = true;
          if (pending) update();
          return release;
        };
      });
      if (found) return value;
      if (argument !== false) throw new Error(`Could not find ${Type} in context.`);
    };
  });

  return render();
};
