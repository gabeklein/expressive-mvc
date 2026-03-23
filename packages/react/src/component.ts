import { State, Context, watch, unbind } from '@expressive/state';
import { ReactNode, createElement, useState, useEffect } from 'react';
import { Layers, Provide } from './context';

const PROPS = new WeakMap<object, Props<any>>();

export type StateProps<T extends State> = {
  [K in Exclude<keyof T, keyof Component>]?: T[K];
};

type AssertCompat<T extends State, P> = {
  [K in keyof P]: K extends keyof StateProps<T>
    ? StateProps<T>[K & keyof StateProps<T>]
    : P[K]
};

export type Props<T extends State, P extends AssertCompat<T, P> = {}> = Readonly<
  StateProps<T> & P & {
    /**
     * Callback for newly created instance. Only called once.
     */
    is?: (instance: T) => void;

    /**
     * Children to render within component. Will be passed as `children` prop.
     */
    children?: ReactNode;
  }
>;

export interface Component<P = {}> extends State {
  readonly props: Props<this> & P;
  context: Context;
  state: State.Values<this>;
  fallback?: ReactNode;

  render(): ReactNode;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  setState: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  forceUpdate: (callback?: () => void) => void;

  componentWillUnmount(): void;
}

declare module '@expressive/state' {
  namespace State {
    export type { Component, Props };
  }
}

Object.defineProperty(State, 'contextType', {
  configurable: true,
  writable: true,
  value: Layers
});

Object.defineProperties(State.prototype, {
  isReactComponent: { value: true },
  shouldComponentUpdate: {
    configurable: true,
    value(this: Component, props: any) {
      PROPS.set(this.is, props);
      this.set(props);
      return true;
    }
  },
  componentWillUnmount: {
    configurable: true,
    value(this: Component) {
      this.context.pop();
      this.set(null);
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
      const Wrapped = (Render as Function).bind(self, render);
      self.render = () => createElement(Wrapped);
    },
    get() {
      return Context.get(this);
    }
  }
});

function Render<T extends Component>(
  this: T,
  render: (self: T) => ReactNode
) {
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
        fallback: active.fallback,
        children: createElement(View)
      });
    };
  });

  return state[0]();
}
