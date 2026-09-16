import type { ComponentType, FunctionComponent } from './vnode';
import { vnode } from './vnode';

type Module<P> = { default: ComponentType<P> } | ComponentType<P>;

function lazy<P>(load: () => Promise<Module<P>>): FunctionComponent<P> {
  let pending: Promise<void> | undefined;
  let resolved: ComponentType<P> | undefined;
  let rejected: unknown;
  let failed = false;

  return function Lazy(props: P) {
    if (failed) throw rejected;
    if (resolved) return vnode(resolved, props);

    if (!pending)
      pending = load().then(
        (module) => {
          resolved = typeof module == 'function' ? module : module.default;
        },
        (error) => {
          failed = true;
          rejected = error;
        }
      );

    throw pending;
  };
}

export { lazy };
