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

  return function Lazy(props) {
    if (resolved) return vnode(resolved, props);

    throw (pending ||= load()
      .then((module) => {
        const output = typeof module == 'function' ? module : module?.default;

        if (typeof output != 'function') throw new Error('lazy() loader resolved no component.');

        resolved = output;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      }));
  };
}

export { lazy };
