import { Component, toJSX } from '@expressive/mvc';
import { createProvider, type Context } from './context';
import { Runtime, useWatch } from './runtime';

declare module '@expressive/mvc' {
  interface Component {
    /**
     * Optional hook called once this Component commits. Return a function to
     * run when it unmounts.
     *
     * Not called during server render, nor for an instance placed as
     * `{component}` - a placement does not own what it renders. Client-only
     * effects belong here; setup which must accompany the instance itself
     * belongs in `new()`.
     */
    mount?(): (() => void) | void;

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

const jsx = toJSX((owner) => useWatch(owner));

/**
 * On the root Component, host own-property keys are trapped so each lands as a
 * plain own property (out of observed state); each adapter assigns its own set.
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

    jsx.type!(type);
  },
  pre: jsx.pre
});

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
 * Wrap a content element in its context provider, a Suspense boundary (unless
 * `fallback` is `false`) and, when `catch` is set, the host error boundary.
 */
function createFrame(from: Component, context: Context, children: unknown) {
  const { createElement } = Runtime;

  if(from.fallback !== false)
    children = createElement(
      Runtime.Suspense,
      { fallback: from.fallback, name: String(from) },
      children
    )

  children = createProvider(context, children);

  return from.catch
    ? createElement(Runtime.ErrorBoundary, { self: from, children })
    : children;
}

/**
 * Ownership host for `<Component/>`: React owns the instance, so its render
 * threads the bootstrap-pushed context through `Runtime.dedupe` (React stacks
 * render attempts) and tears that context down - destroying the instance - on
 * unmount.
 */
function render(from: Component, context: Context) {
  const { createElement } = Runtime;
  const { commit, remove } = Runtime.dedupe(from, context);
  const { is: owner, render } = from;

  const Render = () => render.call(from, from.props);
  const Component = () => {
    from = useWatch(from, () => {
      const release = owner.mount?.();

      commit();

      return () => {
        if (typeof release == 'function') release();
        remove();
        context.pop();
      };
    });

    return createFrame(from, context, createElement(Render));
  };

  return () => createElement(Component);
}

export { createFrame };
