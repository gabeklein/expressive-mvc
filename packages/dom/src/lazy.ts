import type { JSX } from './jsx-runtime';
import type { ComponentType, Node } from './vnode';
import { vnode } from './vnode';

type Attributes<T> = [T] extends [never] ? {}
  : T extends abstract new (...args: any[]) => infer I
  ? JSX.LibraryManagedAttributes<T, I>
  : T extends (props: infer P) => any ? P : never;

function lazy<T extends ComponentType>(load: () => Promise<T | { default: T }>): (props: Attributes<T>) => Node {
  let pending: Promise<void> | undefined;
  let resolved: ComponentType | undefined;
  let failed: { error: unknown } | undefined;

  return function Lazy(props) {
    if (resolved) return vnode(resolved, props);

    if (failed) {
      const { error } = failed;
      failed = undefined;
      throw error;
    }

    throw (pending ||= load().then(
      (module) => {
        const output = typeof module == 'function' ? module : module?.default;

        if (typeof output == 'function') resolved = output;
        else failed = { error: new Error('lazy() loader resolved no component.') };

        pending = undefined;
      },
      (error) => {
        failed = { error };
        pending = undefined;
      }
    ));
  };
}

export { lazy };
