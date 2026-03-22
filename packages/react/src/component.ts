import { State, Context, watch, unbind } from '@expressive/state';
import { ReactNode, createElement, useState, useEffect } from 'react';
import { Layers, Provide } from './context';

const PROPS = new WeakMap<object, Props<any>>();

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

export type Props<T extends State> = Readonly<
  StateProps<T> & {
    /**
     * Callback for newly created instance. Only called once.
     */
    is?: (instance: T) => void;

    /**
     * A fallback react tree to show when suspended.
     * If not provided, `fallback` property of the Component will be used.
     */
    fallback?: ReactNode;

    /**
     * Children to render within component. Will be passed as `children` prop.
     */
    children?: ReactNode;
  }
>;

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

class Component<P = {}> extends State {
  static contextType = Layers;

  declare readonly props: Props<this> & P;

  declare context: Context;

  declare fallback: ReactNode | undefined;

  /** @deprecated Only for React JSX compatibility and nonfunctional. */
  declare setState: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility and nonfunctional. */
  declare forceUpdate: (callback?: () => void) => void;

  readonly isReactComponent = true;

  get state() {
    return this.get() as State.Values<this>;
  }

  shouldComponentUpdate() {
    return true;
  }

  componentWillUnmount() {
    this.context.pop();
    this.set(null);
  }

  render(): ReactNode {
    return this.props.children || null;
  }

  constructor(nextProps: any, ...rest: any[]) {
    const { is, ...props } = nextProps;

    if (rest[0] instanceof Context) rest.shift();

    super(props, {}, rest, is && ((x: any) => void is(x)));
    PROPS.set(this, props);
  }
}

Object.defineProperties(Component.prototype, {
  props: {
    configurable: true,
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
    set(this: Component, ctx: Context) {
      const { is: self, props = {} } = this;
      const child = ctx.push(self);

      Object.defineProperty(self, 'context', {
        get: () => child,
        set() {}
      });

      if (!PROPS.has(self)) {
        PROPS.set(self, props);
        if (typeof props.is === 'function') props.is(self);
      }

      const render = unbind(this.render);
      const Wrapped = Render.bind(self, render);
      self.render = () => createElement(Wrapped);
    },
    get() {
      return Context.get(this);
    }
  }
});

function Render<T extends Component>(this: T, render: (self: T) => ReactNode) {
  const state = useState(() => {
    let ready: boolean | undefined;
    let active: T;

    watch(this, (current) => {
      active = current as T;

      if (ready) state[1]((x) => x.bind(null));
    });

    const View = () => render.call(active, active);

    return () => {
      ready = false;

      useEffect(() => {
        ready = true;
      });

      return createElement(Provide, {
        context: this.context,
        name: String(this),
        fallback: this.props.fallback || active.fallback,
        children: createElement(View)
      });
    };
  });

  return state[0]();
}

export { Component };
