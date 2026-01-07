import { METHOD, Model } from '@expressive/mvc';
import React from 'react';
import Runtime from 'react/jsx-runtime';

import { createProvider } from './context';

export declare namespace JSX {
  type ElementType =
    | Model.Type<Model.Compat>
    | React.JSX.ElementType
    | ((props: {}, ref?: any) => void);

  type LibraryManagedAttributes<C, P> =
    // For normal class components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U }
      ? U
      : C extends Model.Type<infer U>
        ? Model.Props<U>
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

function Component<T extends Model.Compat>(
  this: Model.Init<T>,
  { is, ...props }: Model.Props<T>
) {
  const model = this.use(props as any, is);
  const render = METHOD.get(model.render) || props.render || model.render;
  const children = render
    ? render.call(model, props as Model.HasProps<T>, model)
    : props.children;

  return createProvider(
    model,
    children,
    props.fallback || model.fallback,
    String(model)
  );
}

const RENDER = new WeakMap<Function, React.ComponentType>();

export function createElement(
  this: (type: React.ElementType, ...args: any[]) => React.ReactElement,
  type: React.ElementType | Model.Init,
  ...args: any[]
): React.ReactElement {
  if (Model.is(type))
    if (RENDER.has(type)) type = RENDER.get(type)!;
    else RENDER.set(type, (type = Component.bind(type)));

  return this(type, ...args);
}

export const jsx = createElement.bind(Runtime.jsx);
export const jsxs = createElement.bind(Runtime.jsxs);

export { Fragment } from 'react';
