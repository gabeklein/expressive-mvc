import * as React from 'react';
import { jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';

import { Model, Provider } from '.';

export declare namespace JSX {
  type ElementType = React.JSX.ElementType | Model.Type;
  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
  type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
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
    ? reactJsx(Provider, { 
      for: type,
      set: props,
      children: props.children 
    }, key)
    : reactJsx(type, props, key);
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
    ? reactJsxs(Provider, { 
      for: type,
      set: props,
      children: props.children 
    }, key)
    : reactJsxs(type, props, key);
}

export { Fragment } from "react";