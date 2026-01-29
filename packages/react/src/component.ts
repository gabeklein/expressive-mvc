import { event, METHOD, watch } from '@expressive/mvc';
import { ReactNode } from 'react';

import { Pragma, ReactState as State } from './state';
import { provide, Layers } from './context';
import { Context } from '.';

const OUTER = new WeakMap<Component, Context>();

export class Component extends State {
  static contextType = Layers;

  private _props!: State.ComponentProps<this>;

  get props(): State.ComponentProps<this> {
    return this._props;
  }

  set props(props: State.ComponentProps<this>) {
    this._props = props;
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

  state!: State.Values<this>;
  children!: ReactNode | ((self: this) => ReactNode);
  fallback?: ReactNode;

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

  /** @deprecated This is purely for React JSX compatibility in typescript. */
  setState!: (state: any, callback?: () => void) => void;

  /** @deprecated This is purely for React JSX compatibility in typescript. */
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
