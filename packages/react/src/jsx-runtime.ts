import { Model } from '@expressive/mvc';
import * as React from 'react';
import * as Runtime from 'react/jsx-runtime';

import { Provider } from './context';

type MaybeArray<T> = T | T[];

declare module '@expressive/mvc' {
  namespace Model {
    type Render<T extends Model> = (this: T, self: T) => React.ReactNode | null;

    type Props<T extends Model> = Partial<Pick<T, Exclude<keyof T, keyof Model>>> & {
      children?: MaybeArray<React.ReactNode | Render<T>>;
    }
  }
}

export declare namespace JSX {
  type ElementType = Model.Type | React.JSX.ElementType;

  type LibraryManagedAttributes<C, P> =
    // For normal class components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U } ? U :
    C extends Model.Type<infer U> ? Model.Props<U> :
    React.JSX.LibraryManagedAttributes<C, P>;

  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  // This is a hack to make TypeScript happy - React one insists on `props` property existing.
  // I await the "Find Out" phase in git issues.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

function component<T extends Model>(
  this: Model.Type<T>,
  child: React.ReactNode | Model.Render<T>,
  key: number){

  if(typeof child == 'function')
    return React.createElement(() => {
      const self = this.get();
      return child.call(self, self);
    }, { key });

  return child;
}

export function createElement(
  this: (
    type: React.ElementType,
    props: Record<string, any>,
    key?: React.Key,
    ...rest: any[]
  ) => React.ReactElement,
  type: React.ElementType,
  props: Record<string, any>,
  key?: React.Key,
  ...args: any[]){

  if(Model.is(type)){
    const { children, ...rest } = props;

    return this(Provider, {
      for: type,
      set: rest,
      children: Array.isArray(children) ?
        children.map(component, type) :
        component.call(type, children, 0)
    }, key, ...args);
  }

  return this(type, props, key, ...args);
}

export const jsx = createElement.bind(Runtime.jsx);
export const jsxs = createElement.bind(Runtime.jsxs);

export { Fragment } from "react";