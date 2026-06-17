import { Component, event, watch, unbind, observer } from '@expressive/mvc';
import { provide, type Context } from './context';
import './state.get';
import './state.use';

export { State } from '@expressive/mvc';
export { Consumer, Provider, Context, provide } from './context';

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
  /** Host own-property keys to trap out of observed state; assigned by each adapter. */
  ignore: string[];
  createElement(type: any, props?: any, ...children: any[]): any;
  createContext<T>(value: T): any;
  useContext(context: any): any;
  useState<S>(initial: S | (() => S)): [S, (next: (previous: S) => S) => void];
  useEffect(effect: () => (() => void) | void, deps?: any[]): void;
  useRef<T>(initial: T): { current: T };
  /** Per-render-attempt lifecycle, set by each adapter (React stacks attempts; others no-op). */
  dedupe(from: Component, context: Context): { commit(): void; remove(): void };
  /** Host error-boundary component, wrapping a Component whose `catch` is set. */
  ErrorBoundary: unknown;
  Suspense: any;
};

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

/** Subscribe to an existing observable instance within a component. */
export function use<T extends object>(subject: T) {
  const { current } = Runtime.useRef<{
    proxy: T;
    source?: T;
    mounted: number;
    unwatch?: () => void;
  }>({ mounted: 0, proxy: subject });

  const update = Runtime.useState(() => current.mounted++)[1];

  if (current.source !== subject) {
    const status = observer(subject);

    if (status === undefined)
      throw new Error('Provided object is not observable.');

    current.unwatch?.();
    current.source = subject;

    if (status === null) {
      current.unwatch = undefined;
      current.proxy = subject;
    } else {
      if (!status.ready) event(subject);

      let init = true;

      current.unwatch = watch(subject, (next, changed) => {
        current.proxy = next;
        if (changed.length && !init)
          update((x) => x + 1);
      });

      init = false;
    }
  }

  Runtime.useEffect(() => () => {
    if (--current.mounted < 1) current.unwatch?.();
  }, []);

  return current.proxy;
}

function bootstrap(this: Component, context: Context){
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

/**
 * Per-instance render host: subscribe the instance, render inside its context
 * provider, wrap pending in Suspense and (when `catch` is set) the host error
 * boundary. Host differences live behind `Runtime.dedupe`/`Runtime.ErrorBoundary`.
 */
function render(from: Component, context: Context) {
  const { createElement: create } = Runtime;
  const { commit, remove } = Runtime.dedupe(from, context);
  
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
      ? create(Runtime.ErrorBoundary, { self: from, children })
      : children;
  };

  return () => create(Component);
}

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

// Host-agnostic seams: `state` is a read-only values bag; `context`'s setter
// pushes a child context, registers the instance for teardown, and installs its
// per-instance render host. Host-specific descriptors stay in each adapter.
Object.defineProperties(Component.prototype, {
  state: {
    set() {},
    get: Component.prototype.get
  },
  context: {
    set: bootstrap
  }
});

/**
 * `State.on` handler that prepares a Component's prototype at bootstrap, before
 * mvc classifies its members:
 *
 * - On the root Component, host own-property keys are trapped so each lands as a
 *   plain own property (out of observed state); each adapter assigns its own set.
 * - capitalized methods are rewritten into subcomponents as non-configurable
 *   getters, so bootstrap skips them too.
 *
 * (Sealing `render` as the content-render seam is handled by core itself.)
 *
 * `before` covers the per-instance case: a capitalized function assigned as an
 * instance field (e.g. `Sidebar = Sidebar` to inject or override one), promoted
 * before `observe` so it is not mistaken for reactive state.
 */
Component.on({
  type(type) {
    if (type === Component)
      for (const key of Runtime.ignore)
        Object.defineProperty(Component.prototype, key, {
          set(value) {
            Object.defineProperty(this, key, { value, writable: true });
          }
        });

    // capitalized methods into subcomponents
    subcomponents(type.prototype);
  },
  before(self){
    // capitalized instance fields into subcomponents
    subcomponents(self, true);
  }
});