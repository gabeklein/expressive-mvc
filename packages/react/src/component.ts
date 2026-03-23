import { State, Context, watch, unbind } from '@expressive/state';
import { ReactNode, createElement, useState, useEffect } from 'react';
import { Layers, Provide } from './context';

const PROPS = new WeakMap<object, Props<any>>();

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
   */
  declare readonly props: Props<this>;

  /** @deprecated Only to satisfy React JSX. Use `this.get(State)` instead. */
  declare readonly context: Context;
  /** @deprecated Only to satisfy React JSX. Use `this.get()` instead. */
  declare readonly state: State.Values<this>;
  /** @deprecated Only to satisfy React JSX; does not exist. */
  declare setState: (state: any, callback?: () => void) => void;
  /** @deprecated Only to satisfy React JSX; does not exist. */
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
    PROPS.set(this, nextProps);
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
  render(): ReactNode {
    return this.props.children || null;
  }
}

Object.defineProperties(Component.prototype, {
  isReactComponent: { value: true },
  state: {
    get(this: Component) {
      return this.get();
    },
    set() {}
  },
  props: {
    get(this: Component) {
      return PROPS.get(this.is)!;
    },
    set(this: Component, props: Props<any>) {
      PROPS.set(this.is, props);
      this.set(props as {});
    }
  },
  context: {
    configurable: true,
    set(this: Component, parent: Context) {
      const self = this.is;
      const context = parent.push(self);

      Object.defineProperty(self, 'context', {
        get: () => context,
        set() {}
      });

      const Compat = Render.bind(self, unbind(this.render));
      self.render = () => createElement(Compat);
    }
  }
});

function Render(
  this: Component,
  render: (props: Component['props']) => ReactNode
) {
  const state = useState(() => {
    let ready: boolean | undefined;
    let active: Component;

    watch(this, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    const View = () => render.call(active, this.props);

    return () => {
      ready = false;

      useEffect(() => {
        ready = true;
      });

      useEffect(
        () => () => {
          Context.get(this).pop();
          this.set(null);
        },
        []
      );

      return createElement(Provide, {
        context: this.context,
        name: String(this),
        fallback: active.fallback,
        children: createElement(View)
      });
    };
  });

  return state[0]();
}

export { Component };
