import { event, METHOD, watch } from '@expressive/mvc';
import React, { FunctionComponent, ReactNode } from 'react';

import { Pragma, ReactState as State } from './state';
import { provide, Layers } from './context';
import { Context } from '.';

const OUTER = new WeakMap<Component, Context>();
const PROPS = new WeakMap<Component, State.ComponentProps<any>>();

type HasProps<T extends State> = {
  [K in Exclude<keyof T, keyof State>]?: T[K];
};

type ComponentProps<T extends State> = Readonly<
  HasProps<T> & {
    /**
     * Callback for newly created instance. Only called once.
     * @returns Callback to run when instance is destroyed.
     */
    is?: (instance: T) => void;

    /**
     * A fallback react tree to show when suspended.
     * If not provided, `fallback` property of the State will be used.
     */
    fallback?: React.ReactNode;
  }
>;

type Props<T extends State> = T extends {
  render(props: infer P, self: any): any;
}
  ? ComponentProps<T> & Omit<P, keyof AsComponent>
  : ComponentProps<T> & { children?: React.ReactNode };

/**
 * Props which will not conflict with a State's use as a Component.
 *
 * Built-in properties must be optional, as they will always be omitted.
 */
type RenderProps<T extends State> = HasProps<T> & {
  is?: never;
  get?: never;
  set?: never;
};

/** State which is not incompatable as Component in React. */
interface AsComponent extends State {
  render?(props: RenderProps<this>, self: this): React.ReactNode;
  fallback?: React.ReactNode;
}

interface FC<
  T extends State,
  P extends State.Assign<T>
> extends FunctionComponent<P & Props<T>> {
  displayName?: string;
  State: State.Extends<T>;
}

declare module './state' {
  namespace ReactState {
    export { ComponentProps, Props, RenderProps, AsComponent, FC };
  }
}

class Component extends State implements React.Component {
  static contextType = Layers;

  get props(): State.ComponentProps<this> {
    return PROPS.get(this) || {};
  }

  private set props(props: State.ComponentProps<this>) {
    PROPS.set(this, props);
    this.set(props as {});
  }

  get context(): Context {
    return Context.get(this)!;
  }

  set context(context: Context) {
    if (OUTER.get(this) === context) return;

    OUTER.set(this, context);
    context.push(this);
  }

  state = {} as State.Values<this>;
  children: ReactNode | ((self: this) => ReactNode) = null;
  fallback?: ReactNode = undefined;

  constructor({ is, ...props }: any) {
    super(props, is);
    const self = Render.bind(this, METHOD.get(this.render));
    this.render = () => Pragma.createElement(self);
  }

  render(): ReactNode {
    return typeof this.children === 'function'
      ? this.children(this)
      : this.children;
  }

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  setState!: (state: any, callback?: () => void) => void;

  /** @deprecated Only for React JSX compatibility in typescript and nonfunctional. */
  forceUpdate!: (callback?: () => void) => void;
}

Object.defineProperty(Component.prototype, 'isReactComponent', {
  get: () => true
});

function Render<T extends Component>(this: T, render: () => ReactNode) {
  const state = Pragma.useState(() => {
    event(this);

    const { context } = this;

    let ready: boolean | undefined;
    let active: T;

    watch(this, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    const didMount = () => {
      ready = true;
      return () => {
        context.pop();
        this.set(null);
      };
    };

    const Render = () => render.call(active);

    return () => {
      ready = false;

      Pragma.useEffect(didMount, []);
      setTimeout(() => (ready = true), 0);

      return provide(
        context,
        Pragma.createElement(Render),
        active.fallback,
        String(this)
      );
    };
  });

  return state[0]();
}

export { Component, FC, AsComponent, Props, RenderProps, HasProps };
