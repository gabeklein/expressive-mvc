import { watch, unbind } from '@expressive/state';
import { createElement, useEffect, useState, type ReactNode } from 'react';
import { Context, Layers, Provide } from './context';
import { State } from './state';

const PENDING = new WeakMap<object, Component>();

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type RenderProps<T> = T extends { render(props: infer P): any }
  ? {} extends P
    ? { children?: ReactNode }
    : P
  : { children?: ReactNode };

interface ComponentProps<T extends Component> {
  /** Callback for newly created instance. Only called once. */
  is?: (instance: T) => void;

  /** Fallback to show when suspended. Overrides the instance property. */
  fallback?: ReactNode;
}

export type Props<T extends Component> = StateProps<T> &
  ComponentProps<T> &
  RenderProps<T>;

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

class Component extends State {
  static contextType = Layers;

  /**
   * All JSX attributes passed to this component.
   * Includes state-derived props, render props, and built-in props like `is` and `fallback`.
   *
   * Will incorperate extra props you declare as props parameter in `render` method.
   */
  readonly props!: Props<this>;

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
  fallback: ReactNode = null;

  constructor(nextProps: any, ...rest: any[]) {
    const { is, ...props } = nextProps;
    rest = rest.filter((x) => !(x instanceof Context));
    super(props, rest, is && ((x: any) => void is(x)));

    const existing = PENDING.get(nextProps);
    if (existing) return existing;
    PENDING.set(nextProps, this);

    this.props = nextProps;
    this.set(() => {
      this.set(this.props as {});
    }, 'props');
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
  render(props?: {}): ReactNode {
    return this.props.children || null;
  }
}

Object.defineProperties(Component.prototype, {
  isReactComponent: {
    get() {
      return true;
    }
  },
  state: {
    get(this: Component) {
      return this.get();
    },
    set() {}
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

  let mounts = 0;
  let mounted = false;
  let refresh: ((next: (x: number) => number) => void) | undefined;
  let active: Component;

  watch(self, (current) => {
    active = current;
    if (refresh) refresh((x) => x + 1);
  });

  function Render() {
    return render.call(active, self.props);
  }

  function Component() {
    refresh = useState(0)[1];

    if (!mounted) mounts++;

    useEffect(() => {
      mounted = true;
      return () => {
        if (--mounts) return;
        refresh = undefined;
        self.set(null);
        context.pop();
      };
    }, []);

    return createElement(Provide, {
      context,
      name: String(self),
      fallback: active.fallback,
      children: createElement(Render)
    });
  }

  Object.defineProperties(self, {
    context: {
      get: () => context,
      set() {}
    },
    render: {
      value: () => createElement(Component)
    }
  });
}

export { Component };
