import { watch, unbind, observer, Component } from '@expressive/mvc';
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

      const props = Object.getOwnPropertyDescriptor(this, 'props')!;

      Object.defineProperties(this, {
        props: {
          ...props,
          set: (next: {}) => {
            if (this.get(null))
              Object.defineProperty(this, 'props', {
                value: next,
                writable: true,
                configurable: true
              });
            else
              props.set!.call(this, next);
          }
        },
        context: {
          get: () => context,
          set() { }
        },
        render: {
          value: component(this, context)
        }
      });
    }
  }
});

function component(from: Component, context: Context) {
  const { render } = from;
  const Render = () => render.call(from, from.props);
  const Component = () => {
    from = useHook<Component>((refresh) => {
      if (observer(from) !== null)
        watch(from, refresh);
      return () => {
        from.set(null);
        context.pop();
      };
    }) || from;

    const children = createElement(Layers.Provider, {
      value: context,
      children: createElement(Suspense,
        { fallback: from.fallback, name: String(from) },
        createElement(Render))
    });

    return from.catch
      ? createElement(ErrorBoundary, { self: from, children })
      : children;
  };

  return () => createElement(Component);
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
