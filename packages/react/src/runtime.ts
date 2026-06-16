import { watch, unbind, observer } from '@expressive/mvc';
import type { Component, State } from '@expressive/mvc';
import { provide, type Context } from './context';

declare module '@expressive/mvc' {
  interface Component {
    /** @deprecated Only to satisfy host JSX. Use `this.get(State)` instead. */
    readonly context: Context;
    /** @deprecated Only to satisfy host JSX. Use `this.get()` instead. */
    readonly state: State.Values<this>;
    /** @deprecated Only to satisfy host JSX. Use `this.set({})` instead. */
    setState: (state: any, callback?: () => void) => void;
    /** @deprecated Only to satisfy host JSX. Use `this.set(key)` instead. */
    forceUpdate: (callback?: () => void) => void;
  }
}

export const Runtime = {} as {
  createElement(type: any, props?: any, ...children: any[]): any;
  createContext<T>(value: T): any;
  useContext(context: any): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
  Suspense: any;
  /** Per-render-attempt lifecycle, set by each adapter (React stacks attempts; others no-op). */
  attempt(from: Component, context: Context): { commit(): void; remove(): void };
  /** Host error-boundary component, wrapping a Component whose `catch` is set. */
  boundary: unknown;
};

/**
 * Per-instance render host: subscribe the instance, render inside its context
 * provider, wrap pending in Suspense and (when `catch` is set) the host error
 * boundary. Host differences live behind `Runtime.attempt`/`Runtime.boundary`.
 */
export function render(from: Component, context: Context) {
  const { createElement: create } = Runtime;
  const { commit, remove } = Runtime.attempt(from, context);
  
  const content = from.render;
  const Render = () => content.call(from, from.props);
  const Component = () => {
    from = useHook<Component>((refresh) => {
      if (observer(from) !== null)
        watch(from, refresh);
      return () => {
        remove();
        context.pop();
      };
    }) || from;

    useReady(commit);

    const rendered = create(Render);
    const children = provide(context,
      from.fallback === false
        ? rendered
        : create(Runtime.Suspense,
          { fallback: from.fallback, name: String(from) },
          rendered)
    );

    return from.catch
      ? create(Runtime.boundary, { self: from, children })
      : children;
  };

  return () => create(Component);
}

/**
 * `context` setter shared by both adapters: push a child context, register the
 * instance (with a destroy callback fired when the context pops), guard prop
 * reassignment after teardown, and install the per-instance render host.
 */
export function attach(this: Component, context: Context) {
  context = context.push();
  context.set(this, () => () => this.set(null));

  Object.defineProperties(this, {
    context: {
      get: () => context,
      set() {}
    },
    render: {
      value: render(this, context)
    }
  });

  this.set(null, () => {
    Object.defineProperty(this, 'props', {
      value: this.props,
      writable: true
    });
  })
}

export function useFactory<T extends Function>(factory: () => T) {
  const ref = Runtime.useRef<T | null>(null);
  return ref.current || (ref.current = factory());
}

export function useReady<T>(callback: () => void) {
  return Runtime.useEffect(() => void callback(), []);
}

/**
 * Mount-effect with a refreshable return value, safe under React StrictMode.
 *
 * @param callback Setup handler; receives a setter, must return a cleanup.
 * @returns Latest value published via the setter (`undefined` until set).
 */
export function useHook<T = void>(
  callback: (refresh: (next: T) => void) => () => void
) {
  const { current } = Runtime.useRef(
    { rendered: 0 } as {
      rendered: number;
      mounted?: boolean;
      pending?: boolean;
      unmount: () => void;
      update?: (next: (previous: number) => number) => void;
      output: T;
    }
  );

  current.update = Runtime.useState(() => {
    if (!current.rendered)
      current.unmount = callback((next) => {
        current.output = next;
        if (current.mounted) current.update?.((x) => x + 1);
        else if (current.update) current.pending = true;
      });

    return current.rendered++;
  })[1];

  Runtime.useEffect(() => {
    current.mounted = true;
    if (current.pending) {
      current.pending = false;
      current.update!((x) => x + 1);
    }
    return () => {
      if (--current.rendered < 1) current.unmount();
    }
  }, []);

  return current.output;
}

/**
 * Make host-assigned own-properties land non-enumerable per instance, keeping
 * them out of observed state. The framework writes these on mount (React's
 * `updater`/`_reactInternals`, preact's mangled internals); intercept each via
 * the prototype so the value sits as a plain own property instead of tripping
 * state observation.
 */
export function intercept(proto: object, keys: string[]) {
  for (const key of keys)
    Object.defineProperty(proto, key, {
      set(value) {
        Object.defineProperty(this, key, { value, writable: true });
      }
    });
}

/**
 * `State.on` handler that prepares a Component's prototype at bootstrap, before
 * mvc classifies its members:
 *
 * - `render` is sealed (non-configurable) so bootstrap leaves it unbound - it
 *   stays the content-render seam the chain reads, and preact reads
 *   `prototype.render` directly for its class-component check.
 * - capitalized methods are rewritten into subcomponents as non-configurable
 *   getters, so bootstrap skips them too.
 *
 * `before` covers the per-instance case: a capitalized function assigned as an
 * instance field (e.g. `Sidebar = Sidebar` to inject or override one), promoted
 * before `observe` so it is not mistaken for reactive state.
 */
export const prepare: State.On = {
  type(type) {
    const desc = Object.getOwnPropertyDescriptor(type.prototype, "render");

    if (desc && typeof desc.value == 'function')
      Object.defineProperty(type.prototype, "render", {
        ...desc,
        configurable: false
      });

    // capitalized methods into subcomponents
    subcomponents(type.prototype);
  },
  before(self){
    // capitalized instance fields into subcomponents
    subcomponents(self, true);
  }
};

/** Rewrite each own capitalized function on `target` into a subcomponent. */
function subcomponents(target: object, configurable?: boolean) {
  for (const key of Object.getOwnPropertyNames(target)) {
    if (!/^[A-Z]/.test(key)) continue;
    const { value } = Object.getOwnPropertyDescriptor(target, key)!;
    if (typeof value != 'function') continue;
    Object.defineProperty(target, key, {
      configurable,
      get(this: Component) {
        const owner = this.is;
        let render = unbind(value);
        const Component = (props: unknown) =>
          render.call(
            useHook<Component>((set) => watch(owner, set)) || owner,
            props
          );

        Object.defineProperty(owner, key, {
          configurable: true,
          get: () => Component,
          set(fn: Function) {
            render = fn;
          }
        });

        return Component;
      }
    });
  }
}