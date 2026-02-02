import { METHOD, watch } from '@expressive/mvc';
import React, { FunctionComponent, ReactNode } from 'react';

import { Context, provide } from './context';
import { Pragma, ReactState as State } from './state';


type HasProps<T extends State> = {
  [K in Exclude<keyof T, keyof State>]?: T[K];
};

type ComponentProps<T extends State> = HasProps<T> & {
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
};

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
    export {
      AsComponent,
      ComponentProps,
      FC,
      HasProps,
      Props,
      RenderProps,
    };

    export function as<T extends AsComponent, P extends State.Assign<T>>(
      this: State.Type<T>,
      render: (props: P, self: T) => ReactNode
    ): FC<T, P>
  }
}

State.as = function<T extends AsComponent>(
  this: State.Type<T>,
  render: (props: any, self: T) => ReactNode
){
  const FC = AsRender.bind(this as State.Type<AsComponent>, { render });

  return Object.assign(FC, {
    displayName: this.name,
    State: this
  });
}

export function AsRender<T extends AsComponent>(
  this: State.Type<T>,
  props: Props<T>,
  props2?: Props<T>
) {
  const { is, ...rest } = { ...props, ...props2 };

  const ambient = Context.use();
  const state = Pragma.useState<(props: any) => any>(() => {
    const instance = this.new(rest as {}, is && ((x) => void is(x)));
    const context = ambient.push(instance);

    let ready: boolean | undefined;
    let active: T;

    watch(instance, (current) => {
      active = current;

      if (ready) state[1]((x) => x.bind(null));
    });

    function didMount() {
      ready = true;
      return () => {
        context.pop();
        instance.set(null);
      };
    }

    function Render(props: Props<T>) {
      const render = METHOD.get(active.render) || props.render || active.render;

      return render
        ? render.call(active, props as HasProps<T>, active)
        : props.children;
    }

    return (props: RenderProps<T>) => {
      ready = false;

      Pragma.useEffect(didMount, []);
      Promise.resolve(instance.set(props as {})).finally(() => {
        ready = true;
      });

      return provide(
        context,
        Pragma.createElement(Render, props as any),
        props.fallback || active.fallback,
        String(instance)
      );
    };
  });

  return state[0](rest);
}