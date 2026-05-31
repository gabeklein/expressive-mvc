import { watch, unbind, Component } from '@expressive/state';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import { useHook } from './runtime';

const SEEN = new WeakSet<object>([Component.prototype]);

type ComponentType = typeof Component & typeof React.Component;

declare module '@expressive/state' {
  namespace Component {
    interface JSX {
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
  Object.defineProperty(Component.prototype, key, {
    set(value) {
      Object.defineProperty(this, key, { value, writable: true });
    }
  });

Object.defineProperties(Component.prototype, {
  isReactComponent: {
    get: () => true
  },
  state: {
    set() { },
    get(this: Component) {
      return this.get();
    }
  },
  context: {
    set: bootstrap
  }
});

function bootstrap(this: Component, context: Context) {
  const self = this.is;
  const render = unbind(this.render);

  context = context.push(self);

  let active: Component;

  function Render() {
    return render.call(active, self.props);
  }

  function AsComponent() {
    useHook((refresh) => {
      watch(self, (current) => {
        active = current;
        refresh();
      });

      return () => {
        self.set(null);
        context.pop();
      };
    });

    const children = createElement(Layers.Provider, {
      value: context,
      children: createElement(
        Suspense,
        { fallback: active.fallback, name: String(self) },
        createElement(Render)
      )
    });

    return active.catch
      ? createElement(ErrorBoundary, { self, children })
      : children;
  }

  Object.defineProperties(self, {
    context: {
      get: () => context,
      set() { }
    },
    render: {
      value() {
        return createElement(AsComponent);
      }
    }
  });
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
