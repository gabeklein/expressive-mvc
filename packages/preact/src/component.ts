import { Component } from '@expressive/mvc';
import { attach, intercept, prepare, Runtime } from '@expressive/react/state';

import { ComponentChildren, Ref } from 'preact';
import { Component as PreactComponent } from 'preact/compat';

const proto = Component.prototype;

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: ComponentChildren;
  }
}

declare module '@expressive/mvc' {
  namespace Component {
    interface BaseProps<T extends Component> {
      /**
       * Ref which receives the instance of this component.
       * (Preact JSX does not add `ref` for non-preact classes, so it is
       * declared here - React infers it from its own class attributes.)
       */
      ref?: Ref<T>;
    }
  }
}

Component.on(prepare);

// Preact has no render-attempt stacking (no fiber-keyed supersession); teardown
// is owned by the context, so both hooks are no-ops.
Runtime.attempt = () => ({
  commit() {},
  remove() {}
});

// Preact context Providers subscribe consumers by patching their
// `componentWillUnmount` and re-render them via internal fields. Intercept
// every own property preact assigns onto a mounted class component, so each
// lands non-enumerable - keeping it out of observed state, exactly as the
// React adapter does for `updater` and `_reactInternals`.
intercept(proto, [
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
]);

Object.defineProperties(proto, {
  // Preact identifies class components by the presence of `prototype.render`
  // (it has no `isReactComponent` brand check). This base stub satisfies that
  // check for components that define no render; `subcomponents.type` seals it
  // so bootstrap leaves it a plain method. The per-instance render is installed
  // when context attaches (below), shadowing this.
  render: {
    configurable: true,
    value: () => null
  },
  // Borrowed so preact internals (e.g. context propagation) may request a
  // re-render of this component; they operate on the intercepted fields above.
  forceUpdate: {
    writable: true,
    configurable: true,
    value: PreactComponent.prototype.forceUpdate
  },
  state: {
    set() {},
    get: proto.get
  },
  context: {
    set: attach
  }
});

Runtime.boundary = class ErrorBoundary extends PreactComponent<{
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
};

export { Component };
