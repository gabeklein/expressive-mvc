import * as React from 'react';
import * as Runtime from 'react/jsx-runtime';

import { Model } from '.';
import { Provider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
    type Render<T extends Model> = (this: T, self: T) => React.ReactNode | null;

    type Props<T extends Model> = Partial<Pick<T, Exclude<keyof T, keyof Model>>> & {
      children?: React.ReactNode | Render<T>;
    }
  }
}

export declare namespace JSX {
  type ElementType = Model.Type | React.JSX.ElementType;

  type LibraryManagedAttributes<C, P> =
    // For React Components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U } ? U :
    C extends Model.Type<infer U> ? Model.Props<U> :
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

export function createElement(
  this: (type: React.ElementType, props: Record<string, any>, key?: React.Key) => React.ReactElement,
  type: React.ElementType,
  props: Record<string, any>,
  key?: React.Key){

  if(Model.is(type)){
    const { children, ...rest } = props;

    return this(Provider, {
      for: type,
      set: rest,
      children: Array.isArray(children) ?
        children.map(component, type) :
        component.call(type, children, 0)
    }, key);
  }

  return this(type, props, key);
}

function component<T extends Model>(
  this: Model.Type<T>,
  child: React.ReactNode | Model.Render<T>,
  key: number){

  if(typeof child != 'function')
    return child;

  return React.createElement(() => {
    const self = this.get();
    return child.call(self, self);
  }, { key });
}

/**
 * Create a React element.
 * You should not use this function directly. Use JSX and a transpiler instead.
 */
export const jsx = createElement.bind(Runtime.jsx);
export const jsxs = createElement.bind(Runtime.jsxs);

export { Fragment } from "react";