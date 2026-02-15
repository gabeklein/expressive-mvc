import { State, Context, watch, METHOD } from '@expressive/mvc';

import Runtime from 'react/jsx-runtime';
import React from 'react';

import { Pragma } from './state';
import { provide } from './context';

type Reserved = keyof State | 'render' | 'fallback';

type StateProps<T extends State> = {
  [K in Exclude<keyof T, Reserved>]?: T[K];
};

type ManagedChildren<T extends State> = 'children' extends keyof T
  ? { children?: T['children'] }
  : {};

type ComponentBaseProps<T extends State> = Readonly<
  Omit<StateProps<T>, 'children'> &
    ManagedChildren<T> & {
      is?: (instance: T) => void;
      fallback?: React.ReactNode;
    }
>;

type RuntimeOptions<T extends State> = {
  render?: T extends { render: infer R } ? R : never;
  fallback?: React.ReactNode;
};

type AsRenderProps<T extends State> = StateProps<T> &
  RuntimeOptions<T> & {
    is?: never;
    get?: never;
    set?: never;
  };

interface AsComponent extends State {
  render?(props: AsRenderProps<this>, self: this): React.ReactNode;
  fallback?: React.ReactNode;
}

type Props<T extends State> = T extends {
  render(props: infer P, self: any): any;
}
  ? ComponentBaseProps<T> & Omit<P, keyof AsComponent>
  : ComponentBaseProps<T> & { children?: React.ReactNode };

type RuntimeProps<T extends State> = Props<T> & RuntimeOptions<T>;

export declare namespace JSX {
  type ElementType =
    | State.Extends<AsComponent>
    | React.JSX.ElementType
    | ((props: {}, ref?: any) => void);

  type LibraryManagedAttributes<C, P> =
    // For normal class components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U }
      ? U
      : C extends State.Extends<infer U>
        ? Props<U>
        : React.JSX.LibraryManagedAttributes<C, P>;

  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}

  // This is a hack to make TypeScript happy - React's interface insists on `props` property existing.
  // I await the "Find Out" phase of this in git issues.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute
    extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX
    .IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

const RENDER = new WeakMap<Function, React.ComponentType>();

export function patch(
  this: (type: React.ElementType, ...args: any[]) => React.ReactElement,
  type: React.ElementType | State.Type,
  ...args: any[]
): React.ReactElement {
  if (State.is(type))
    if (RENDER.has(type)) type = RENDER.get(type)!;
    else RENDER.set(type, (type = Render.bind(type)));

  return this(type, ...args);
}

export const jsx = patch.bind(Runtime.jsx);
export const jsxs = patch.bind(Runtime.jsxs);

function Render<T extends AsComponent>(
  this: State.Type<T>,
  props: RuntimeProps<T>,
  props2?: RuntimeProps<T>
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

    function Render(props: RuntimeProps<T>) {
      const render = METHOD.get(active.render) || props.render || active.render;

      return render
        ? render.call(active, props as StateProps<T>, active)
        : props.children;
    }

    return (props: RuntimeProps<T>) => {
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

export { Fragment } from 'react';
