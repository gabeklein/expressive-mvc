import { watch, unbind } from '@expressive/state';
import { Component, subcomponents } from '@expressive/component';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import type { State } from './state';
import { useHook } from './runtime';

const INTERNAL = [
  'updater',
  'refs',
  '_reactInternals',
  '_reactInternalInstance'
];

const RESET = Symbol.for('React.StrictMode');

declare module '@expressive/component' {
  interface Host {
    node: React.ReactNode;
  }

  interface Component {
    /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
    readonly context: Context;
    /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
    readonly state: State.Values<this>;
    /** @deprecated Only to satisfy React JSX. Not implemented. */
    setState: (state: any, callback?: () => void) => void;
    /** @deprecated Only to satisfy React JSX. Not implemented. */
    forceUpdate: (callback?: () => void) => void;
  }

  namespace Component {
    let contextType: React.Context<Context>;
  }
}

Component.on((self) => {
  for (const key of INTERNAL)
    Object.defineProperty(self, key, {
      configurable: true,
      writable: true,
      enumerable: false
    });

  subcomponents(self, function (render) {
    return (props: unknown) => {
      return render(useHook((set) => watch(this, set)), props);
    }
  });
});

Component.contextType = Layers;

Object.defineProperties(Component.prototype, {
  isReactComponent: {
    get: () => true
  },
  state: {
    get(this: Component) {
      return this.get();
    },
    set() { }
  },
  context: {
    configurable: true,
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
      set(this: Component & { [RESET]?: () => void }) {
        this[RESET]?.();
      }
    },
    render: {
      value() {
        return createElement(AsComponent);
      }
    }
  });
}

interface BoundaryProps {
  self: Component;
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<BoundaryProps> {
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
export type { Props, StateProps } from '@expressive/component';
