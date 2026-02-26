import { State } from '@expressive/state';

import Runtime from 'react/jsx-runtime';
import React from 'react';

import { toComponent, AsComponent, ComponentProps } from './component';

type NormalComponent<P> = new (...args: any[]) => { props: P };

export declare namespace JSX {
  type ElementType =
    | State.Extends<AsComponent>
    | React.JSX.ElementType
    | ((props: {}, ref?: any) => void);

  type LibraryManagedAttributes<C, P> =
    C extends State.Extends<infer T>
      ? T extends { render(...args: any[]): any }
        ? Omit<ComponentProps<T>, 'children'>
        : ComponentProps<T>
      : C extends NormalComponent<infer U>
        ? U
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
    else RENDER.set(type, (type = toComponent(type)));

  return this(type as React.ElementType, ...args);
}

export const jsx = patch.bind(Runtime.jsx);
export const jsxs = patch.bind(Runtime.jsxs);

export { Fragment } from 'react';
