import { Model } from '@expressive/mvc';
import * as React from 'react';
import * as Runtime from 'react/jsx-runtime';

import { Provider } from './context';

type MaybeArray<T> = T | T[];

declare module '@expressive/mvc' {
  namespace Model {
    type Render<T extends Model> = (this: T, self: T) => React.ReactNode | void;

    /** Model which can be used directly as Component in React. */
    interface Compat extends Model {
      render?(props: Model.Assign<this>, self: this): React.ReactNode | void;
      children?: React.ReactNode;
    }

    type Props<T extends Model> = 
      T extends { render(props: infer P): any }
        ? Partial<Pick<T, Exclude<keyof T, keyof Model | "render">>> & P
        : Partial<Pick<T, Exclude<keyof T, keyof Model>>> & {
          children?: MaybeArray<React.ReactNode | Render<T>>
        }
  }
}

export declare namespace JSX {
  type ElementType = Model.Type<Model.Compat> | React.JSX.ElementType;

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
      return child.call(self, self) || null;
    }, { key });

  return child;
}

function Render<T extends Model.Compat>(
  this: Model.Init<T>,
  set: Model.Assign<T>
){
  return React.createElement(Provider, { for: this, set }, 
    React.createElement(() => {
      const { render } = this.get();

      if(render)
        return React.createElement(() => {
          const self = this.get();
          return render.call(self, set, self) || null;
        })

      return ([] as any[]).concat(set.children).map(component, this)
    })
  );
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

  if(Model.is(type))
    return this(Render.bind(type as Model.Init), props, key, ...args);

  return this(type, props, key, ...args);
}

export const jsx = createElement.bind(Runtime.jsx);
export const jsxs = createElement.bind(Runtime.jsxs);

export { Fragment } from "react";