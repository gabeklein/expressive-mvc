import State from '@expressive/mvc';
import Runtime from 'react/jsx-runtime';
import React from 'react';

import { Render, AsComponent, Props } from './state';

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

export { Fragment } from 'react';
