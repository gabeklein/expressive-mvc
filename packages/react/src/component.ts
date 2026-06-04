import { watch, unbind, Component, CONTENT } from '@expressive/mvc';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import { useHook } from './runtime';

const proto = Component.prototype;
const SEEN = new WeakSet<object>([proto]);

type ComponentType = typeof Component & typeof React.Component;

declare module '@expressive/mvc' {
  namespace Component {
    interface Host {
      node: React.ReactNode;
    }
  }

  interface Component {
    /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
    readonly context: Context;
    /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
    readonly state: State.Values<this>;
    /** @deprecated Only to satisfy React JSX. Use `this.set({})` instead. */
    setState: (state: any, callback?: () => void) => void;
    /** @deprecated Only to satisfy React JSX. Use `this.set(key)` instead. */
    forceUpdate: (callback?: () => void) => void;
  }
}

Component.on(subcomponents);
(Component as ComponentType).contextType = Layers;

for (const key of [
  'updater',
  'refs',
  '_reactInternals',
  '_reactInternalInstance'
])
  Object.defineProperty(proto, key, {
    set(value) {
      Object.defineProperty(this, key, { value, writable: true });
    }
  });

/** Parent context React injects via `contextType`, kept off managed state. */
const PARENT = new WeakMap<Component, Context>();

Object.defineProperties(proto, {
  isReactComponent: {
    get: () => true
  },
  state: {
    set() { },
    get: proto.get
  },
  // Keep `context` a non-data accessor so React's assignment isn't adopted as
  // a managed field by State's `observe()`. Holds the parent until the seam
  // pushes, then the pushed context for any JSX-facing reads.
  context: {
    get(this: Component) { return PARENT.get(this.is) },
    set(this: Component, value: Context) { PARENT.set(this.is, value) }
  }
});

// React invokes the seam (with `this.context` already populated), so building
// the host here is render-triggered. The host is created once per instance and
// reconciled in place on re-renders.
Component.adapt((self) => {
  const context = PARENT.get(self)!.push(self);
  PARENT.set(self, context);
  let current: Component;

  const Content = () => (self as any)[CONTENT].call(current, self.props);

  const Host: React.FC = () => {
    current = useHook((refresh) => {
      watch(self, refresh);
      return () => {
        self.set(null);
        context.pop();
      };
    });

    const children = createElement(Layers.Provider, {
      value: context,
      children: createElement(Suspense,
        { fallback: current.fallback, name: String(self) },
        createElement(Content))
    });

    return current.catch
      ? createElement(ErrorBoundary, { self, children })
      : children;
  };

  return () => createElement(Host);
});

function subcomponents(proto: Component) {
  do {
    if (SEEN.has(proto)) return;

    SEEN.add(proto);

    for (const key of Object.getOwnPropertyNames(proto))
      if (/^[A-Z]/.test(key)) {
        const { get, value } = Object.getOwnPropertyDescriptor(proto, key)!;

        if (get || typeof value == 'function')
          Object.defineProperty(proto, key, {
            configurable: true,
            get(this: Component) {
              const owner = this.is;
              let render = unbind(get ? get.call(owner) : value);
              const Component = (props: unknown) =>
                render.call(
                  useHook<Component>((set) => watch(owner, set)),
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
  } while ((proto = Object.getPrototypeOf(proto)));
}

class ErrorBoundary extends React.Component<{
  self: Component;
  children: React.ReactNode;
}> {
  state = {} as { error?: Error };
  recovering = false;

  constructor(props: ErrorBoundary['props']) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const { self } = this.props;
    const { fallback } = self;
    const reset = (error?: Error) => {
      this.recovering = true;
      this.setState({ error });
    };

    Promise.resolve(self.catch!(error))
      .then(() => reset(), reset)
      .finally(() => self.set({ fallback }, true));
  }

  componentDidUpdate() {
    this.recovering = false;
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.recovering) throw this.state.error;
    return this.props.self.fallback;
  }
}

export { Component };
