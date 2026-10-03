import type { JSX } from './jsx-runtime';
import type { ComponentType, Node } from './vnode';
import { vnode } from './vnode';

type Module<T extends ComponentType = ComponentType> = T | { default: T };

type Attributes<T> = [T] extends [never] ? {}
  : T extends abstract new (...args: any[]) => infer I
  ? JSX.LibraryManagedAttributes<T, I>
  : T extends (props: infer P) => any ? P : never;

interface Load {
  pending: PromiseLike<void>;
  resolved?: ComponentType;
  failed?: { error: unknown };
}

const LOADS = new WeakMap<Function, Load>();

function resolve(type: Function, props: object, run: () => unknown): Node {
  const load = LOADS.get(type);

  if (load?.resolved) return vnode(load.resolved, props);

  if (load?.failed) {
    LOADS.delete(type);
    throw load.failed.error;
  }

  if (load) throw load.pending;

  const output = run();

  if (!output || typeof (output as PromiseLike<unknown>).then != 'function') return output as Node;

  const next = {} as Load;

  LOADS.set(type, next);

  throw next.pending = (output as PromiseLike<Module | undefined>).then(
    (module) => {
      const component = typeof module == 'function' ? module : module?.default;

      if (typeof component == 'function') next.resolved = component;
      else next.failed = { error: new Error('Loader resolved no component.') };
    },
    (error) => {
      next.failed = { error };
    }
  );
}

export { resolve };
export type { Attributes, Module };
