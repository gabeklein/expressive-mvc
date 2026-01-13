import { event, METHOD, watch } from '@expressive/mvc';
import React, { ReactNode } from 'react';

import { provide, Layers } from './context';
import { Model, Context } from '.';

export class Component extends Model {
  static contextType = Layers;

  private _props!: Model.ComponentProps<this>;

  get props(): Model.ComponentProps<this> {
    return this._props;
  }

  set props(props: Model.ComponentProps<this>) {
    this._props = props;
    this.set(props as {});
  }

  state!: Model.State<this>;
  context!: Context;
  children!: ReactNode;
  fallback?: ReactNode;

  constructor({ is, ...props }: any) {
    super(props, is);
    const Bridge = Render.bind(this, METHOD.get(this.render) || this.render);
    this.render = () => React.createElement(Bridge);
  }

  render(): ReactNode {
    return this.children;
  }

  /** @deprecated This is purely for React JSX compatibility in typescript. */
  setState!: (state: any, callback?: () => void) => void;

  /** @deprecated This is purely for React JSX compatibility in typescript. */
  forceUpdate!: (callback?: () => void) => void;
}

Object.defineProperty(Component.prototype, 'isReactComponent', {
  get: () => true
});

function Render<T extends Component>(this: T, render: () => React.ReactNode) {
  const ambient = React.useContext(Layers);
  const state = React.useState(() => {
    event(this);
    const context = ambient.push(this);

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

    function Render() {
      return render ? render.call(active) : active.children;
    }

    return () => {
      ready = false;

      React.useEffect(didMount, []);
      Promise.resolve(this.set()).finally(() => {
        ready = true;
      });

      return provide(
        context,
        React.createElement(Render),
        active.fallback,
        String(this)
      );
    };
  });

  return state[0]();
}
