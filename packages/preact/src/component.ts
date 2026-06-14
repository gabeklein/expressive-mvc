import { watch, unbind, Component } from '@expressive/mvc';
import { useHook, Context, Layers } from '@expressive/react/state';

import { ComponentChildren, Ref } from 'preact';
import { Component as PreactComponent, createElement, Suspense } from 'preact/compat';

const proto = Component.prototype;
const SEEN = new WeakSet<object>([proto]);

declare module '@expressive/mvc' {
  namespace Component {
    interface Host {
      node: ComponentChildren;
    }

    interface BaseProps<T extends Component> {
      /**
       * Ref which receives the instance of this component.
       * (Preact JSX does not add `ref` for non-preact classes, so it is
       * declared here - React infers it from its own class attributes.)
       */
      ref?: Ref<T>;
    }
  }

  interface Component {
    /** @deprecated Only to satisfy Preact JSX. Use `this.get(State)` instead. */
    readonly context: Context;
    /** @deprecated Only to satisfy Preact JSX. Use `this.get()` instead. */
    readonly state: State.Values<this>;
    /** @deprecated Only to satisfy Preact JSX. Use `this.set({})` instead. */
    setState: (state: any, callback?: () => void) => void;
    /** @deprecated Only to satisfy Preact JSX. Use `this.set(key)` instead. */
    forceUpdate: (callback?: () => void) => void;
  }
}

Component.on(subcomponents);
Object.defineProperty(Component, 'contextType', { configurable: true, get: Layers });

// Preact identifies class components by the presence of `prototype.render`
// (it has no `isReactComponent` brand check). The stub is shadowed by the
// per-instance render installed when context attaches, and sits on the seam
// itself so the mvc render chain ignores it. Defined as a get/set accessor
// pair so mvc class-setup will not convert it into a reactive method - the
// getter may be invoked with the prototype itself as receiver.
function render() {
  return null;
}

Object.defineProperty(proto, 'render', {
  configurable: true,
  get: () => render,
  set(value) {
    Object.defineProperty(this, 'render', {
      value,
      writable: true,
      configurable: true
    });
  }
});

// Preact context Providers subscribe consumers by patching their
// `componentWillUnmount` and re-render them via internal fields. Intercept
// every own property preact assigns onto a mounted class component, so each
// lands non-enumerable - keeping it out of observed state, exactly as the
// React adapter does for `updater` and `_reactInternals`.
for (const key of [
  // mangled preact internals (stable across preact 10.x):
  '__v', // _vnode
  '__n', // _globalContext
  '__d', // _dirty
  '__e', // _force
  '__h', // _renderCallbacks
  '_sb', // _stateCallbacks
  '__s', // _nextState
  '__P', // _parentDom
  '__z', // unmounted flag (preact/compat suspense)
  '__R', // suspended-retry callback (preact/compat suspense)
  'base',
  'componentWillUnmount'
])
  Object.defineProperty(proto, key, {
    set(value) {
      Object.defineProperty(this, key, { value, writable: true });
    }
  });

Object.defineProperties(proto, {
  // Borrowed so preact internals (e.g. context propagation) may request a
  // re-render of this component; they operate on the intercepted fields above.
  forceUpdate: {
    writable: true,
    configurable: true,
    value: PreactComponent.prototype.forceUpdate
  },
  state: {
    set() { },
    get: proto.get
  },
  context: {
    set(this: Component, context: Context) {
      context = context.push(this);

      Object.defineProperties(this, {
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
    from = useHook((refresh) => {
      watch(from, refresh);
      return () => {
        from.set(null);
        context.pop();
      };
    });

    const children = createElement(Layers().Provider, {
      value: context,
      children: createElement(Suspense,
        { fallback: from.fallback },
        createElement(Render, null))
    });

    return from.catch
      ? createElement(ErrorBoundary, { self: from, children })
      : children;
  };

  return () => createElement(Component, null);
}

function subcomponents(proto: Component) {
  do {
    if (SEEN.has(proto)) return;

    SEEN.add(proto);

    // State setup converts prototype methods into reactive accessors which
    // require an instance receiver. Preact however reads `T.prototype.render`
    // on every diff (its class-component check), with the prototype itself as
    // receiver. Restore `render` to a plain method - harmless, as instances
    // always shadow it with the composed render installed by the constructor.
    const render = Object.getOwnPropertyDescriptor(proto, 'render');

    if (render && render.get)
      Object.defineProperty(proto, 'render', {
        value: unbind(render.get),
        writable: true,
        configurable: true
      });

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

class ErrorBoundary extends PreactComponent<{
  self: Component;
  children: ComponentChildren;
}> {
  state = {} as { error?: Error };
  recovering = false;

  constructor(props: ErrorBoundary['props']) {
    super(props);
  }

  // Note: error state is assigned here rather than via a static
  // getDerivedStateFromError. Preact's catch-error walk would otherwise
  // remember the dirtiness caused by gDSFE and treat a throw from
  // componentDidCatch as handled at the next ancestor instead of
  // propagating it to the next boundary up.
  componentDidCatch(error: Error) {
    // A throw while still recovering means the previous catch did not fix
    // the problem - propagate. (React reaches the equivalent state through a
    // synchronous re-render throwing in `render` while `recovering` is set;
    // preact re-renders asynchronously, after `recovering` already cleared,
    // so the failed recovery must be detected here. Thrown errors from
    // componentDidCatch continue up the boundary chain in preact.)
    if (this.recovering) throw error;

    this.setState({ error });

    const { self } = this.props;
    const { fallback } = self;
    // Reset on a macrotask: preact schedules re-renders on microtasks, so a
    // catch which resolves while render still throws would otherwise starve
    // the event loop (React schedules work through its scheduler instead).
    const reset = (error?: Error) =>
      setTimeout(() => {
        this.recovering = true;
        this.setState({ error });
      });

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
