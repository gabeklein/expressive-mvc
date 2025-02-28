import * as React from 'react';
import * as Runtime from 'react/jsx-runtime';

import { Model } from '.';
import { Provider } from './context';

export declare namespace JSX {
  type ElementType = Model.Type | React.JSX.ElementType;

  type LibraryManagedAttributes<C, P> =
    // For React Components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U } ? U :
    C extends Model.Type<infer U> ?
      Partial<Pick<U, Exclude<keyof U, keyof Model>>> & { children?: React.ReactNode } :
      React.JSX.LibraryManagedAttributes<C, P>;

  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  // This is a hack to make TypeScript happy - React insists on `props` property existing.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

/**
 * Create a React element.
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export function jsx(
  type: React.ElementType,
  props: Record<string, any>,
  key?: React.Key,
): React.ReactElement {
  return Model.is(type)
    ? Runtime.jsx(Provider, { for: type, set: props, children: props.children }, key)
    : Runtime.jsx(type, props, key);
}

/**
 * Create a React element.
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export function jsxs(
    type: React.ElementType,
    props: Record<string, unknown>,
    key?: React.Key,
): React.ReactElement {
  return Model.is(type)
    ? Runtime.jsxs(Provider, { for: type, set: props, children: props.children }, key)
    : Runtime.jsxs(type, props, key);
}

export { Fragment } from "react";