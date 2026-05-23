import { watch, unbind, set, observer, touch } from '@expressive/state';
import React, { createElement, Suspense } from 'react';
import { Context, Layers } from './context';
import { useHook } from './runtime';
import { State } from './state';

const PENDING = new WeakMap<object, Component>();
const INTERNAL = [
  'updater',
  'refs',
  '_reactInternals',
  '_reactInternalInstance'
];

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type RenderProps<T> = T extends { render(props: infer P): any }
  ? {} extends P
  ? { children?: React.ReactNode }
  : P
  : { children?: React.ReactNode };

interface ComponentProps<T extends Component> {
  /** Callback for newly created instance. Only called once. */
  is?: (instance: T) => void;

  /** Fallback to show when suspended or in error recovery. */
  fallback?: React.ReactNode;
}

export type Props<T extends Component> = StateProps<T> &
  ComponentProps<T> &
  RenderProps<T>;

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

export class Component extends State {
  static contextType = Layers;

  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  declare readonly props: Props<this>;

  /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
  declare readonly context: Context;
  /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
  declare readonly state: State.Values<this>;
  /** @deprecated Only to satisfy React JSX. Not implemented. */
  declare setState: (state: any, callback?: () => void) => void;
  /** @deprecated Only to satisfy React JSX. Not implemented. */
  declare forceUpdate: (callback?: () => void) => void;

  /**
   * Content to display while this component or its children are suspended.
   * Will cover suspense by pending properties in `this.render` as well.
   * Can be set as a class property or overridden via the `fallback` JSX prop.
   *
   * Defaults to null - nothing will be rendered.
   */
  fallback: React.ReactNode = set(null);

  constructor(nextProps: any, ...rest: any[]) {
    const { is, ...props } = nextProps;
    const seen = {} as Record<string, undefined>;
    const merge = (props: {}) => {
      for (const key in props) seen[key] = undefined;
      return { ...seen, ...props };
    };
    const values = ({ is, ...props }: any) => merge(props);

    rest = rest.filter((x) => !(x instanceof Context));
    super(merge(props), rest, is && ((x) => void is(x)));

    const existing = PENDING.get(nextProps);
    if (existing) return existing;
    PENDING.set(nextProps, this);

    for (const key of INTERNAL)
      Object.defineProperty(this, key, { configurable: true, writable: true });

    let current = nextProps;

    Object.defineProperty(this, 'props', {
      configurable: true,
      enumerable: false,
      get(this: Component) {
        return touch(this, 'props', current);
      },
      set(this: Component, next) {
        current = next;

        if (observer(this)?.ready) {
          this.set(values(next) as {});
          this.set('props');
        }
      }
    });
  }

  /**
   * Output for this component. Override to define custom JSX.
   *
   * Properties accessed via `this` are reactive and will trigger a render when , in addition to props.
   *
   * Accepts optional parameter to receive extra props
   * from JSX, beyond those merged to state properties.
   *
   * To declare extra props use `props = {} as { ... }` with expected shape.
   * A default is required to satisfy TypeScript but safely ignored.
   *
   * ```ts
   * render(props = {} as { label: string }) {
   *   return <span>{props.label}</span>;
   * }
   * ```
   * Usable as:
   * ```tsx
   * <MyComponent label="Hello" />
   * ```
   *
   * These must be compatible with State-derived properties, or be unused.
   * Props you declare as not-optional will be required by the JSX element.
   *
   * Without a parameter, children are accepted by default and passed through provider.
   */
  render(props?: {}): React.ReactNode {
    return this.props.children || null;
  }

  /**
   * Called when a child component throws during render.
   * While this is pending, `fallback` is displayed.
   * When resolved, the error boundary resets and `render` is called again.
   *
   * Override to handle errors - set `this.fallback` for error-specific UI,
   * await async recovery, or await user interaction before retrying. If you
   * assign a fallback within catch, it will be reverted after resolved.
   */
  catch?(error: Error): Promise<void> | void;
}

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
      set() { }
    },
    render: {
      value: () => createElement(AsComponent)
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

const SEEN = new WeakSet<Function>();

Component.on((self) => {
  let Type = self.constructor as State.Extends;

  while (Type !== Component) {
    if (SEEN.has(Type)) break;
    SEEN.add(Type);
    subcomponents(Type.prototype);
    Type = Object.getPrototypeOf(Type);
  }

  subcomponents(self);
});

function subcomponents(self: State) {
  for (const key of Object.getOwnPropertyNames(self)) {
    if (!/^[A-Z]/.test(key)) continue;

    const { get, value } = Object.getOwnPropertyDescriptor(self, key)!;

    if (!get && typeof value !== 'function') continue;

    function subcomponent(this: Component) {
      const self = this.is;

      let render = unbind(get ? get.call(self) : value);

      const Component = (props: unknown) =>
        render.call(
          useHook<Component>((set) => watch(self, set)),
          props
        );

      Object.defineProperty(self, key, {
        configurable: true,
        get: () => Component,
        set(fn: Function) {
          render = fn;
        }
      });

      return Component;
    }

    Object.defineProperty(self, key, {
      configurable: true,
      get: subcomponent
    });
  }
}
