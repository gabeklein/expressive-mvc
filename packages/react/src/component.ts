import { Component, unbind } from '@expressive/mvc';
import { watch, observer } from '@expressive/mvc/observable';
import { provide, type Context } from './context';
import { Runtime, useHook, useReady } from './runtime';

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
function frame(from: Component, context: Context, children: unknown) {
  const { createElement: create } = Runtime;

  if(from.fallback !== false)
    children = create(
      Runtime.Suspense,
      { fallback: from.fallback, name: String(from) },
      children
    )

  children = provide(context, children);

  return from.catch
    ? create(Runtime.ErrorBoundary, { self: from, children })
    : children;
}

/**
 * Ownership host for `<Component/>`: React owns the instance, so its render
 * threads the bootstrap-pushed context through `Runtime.dedupe` (React stacks
 * render attempts) and tears that context down - destroying the instance - on
 * unmount.
 */
function render(from: Component, context: Context) {
  const { createElement: create } = Runtime;
  const { commit, remove } = Runtime.dedupe(from, context);

  const content = from.render;
  const Render = () => content.call(from, from.props);
  const Component = () => {
    from = useHook<Component>((refresh) => {
      if (observer(from) !== null) watch(from, refresh);

      return () => {
        remove();
        context.pop();
      };
    }) || from;

    useReady(commit);

    return frame(from, context, create(Render));
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

export { frame };
