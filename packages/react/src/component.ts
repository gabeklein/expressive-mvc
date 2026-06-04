import { watch, unbind, Component } from '@expressive/mvc';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import { useHook } from './runtime';

const proto = Component.prototype;
const SEEN = new WeakSet<object>([proto]);

/** Adapter seam - shared with core via the global symbol registry (no import). */
const SEAM = Symbol.for('@expressive/mvc.adapter');

/** Host renders we produced - lets the context setter tell a wrapped render from a field override. */
const HOSTS = new WeakSet<Function>();

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

Object.defineProperties(proto, {
  isReactComponent: {
    get: () => true
  },
  state: {
    set() { },
    get: proto.get
  },
  context: {
    set(this: Component, context: Context) {
      context = context.push(this);
      Object.defineProperty(this, 'context', {
        get: () => context,
        set() { }
      });

      // An instance-field render (`render = fn`) overwrites the host core
      // installed in the constructor, after fields initialize. We run after
      // fields but before React reads render - re-wrap the bare field render.
      if (!HOSTS.has(this.render))
        Object.defineProperty(this, 'render', {
          configurable: true,
          writable: true,
          value: host(this, this.render)
        });
    }
  }
});

// Adapter seam - core consults this factory per instance with the composed
// content as `this` and installs the host render we return. The host reads
// `this.context` (pushed by the context setter) lazily at render time.
Object.defineProperty(proto, SEAM, {
  value(this: Component, content: Function) {
    return host(this, content);
  }
});

function host(from: Component, content: Function) {
  let self = from.is;
  const Render = () => content.call(self, self.props);
  const Host = () => {
    self = useHook((refresh) => {
      watch(self, refresh);
      return () => {
        self.set(null);
        self.context.pop();
      };
    });

    const children = createElement(Layers.Provider, {
      value: self.context,
      children: createElement(Suspense,
        { fallback: self.fallback, name: String(self) },
        createElement(Render))
    });

    return self.catch
      ? createElement(ErrorBoundary, { self, children })
      : children;
  };

  const render = () => createElement(Host);
  HOSTS.add(render);
  return render;
}

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
