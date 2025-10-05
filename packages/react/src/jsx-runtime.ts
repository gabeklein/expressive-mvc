import { METHOD, Model } from '@expressive/mvc';
import React from 'react';
import Runtime from 'react/jsx-runtime';

import { createProvider } from './context';

declare module "@expressive/mvc" {
  namespace Model {
    /**
     * Use this to define a component which wraps a Model, intended to forward props.
     * This is to be used explicity, in JSDoc types or type annotations.
     * The second type parameter is additional props the component expects to receive.
     * 
     * @example
     * ```tsx
     * import { Model } from '@expressive/react';
     * 
     * class MyModel extends Model {
     *   foo: string;
     *   bar: number;
     * }
     * 
     * const MyComponent: Model.FC<MyModel, { label: string }> =
     *   ({ label, ...rest }) => (
     *     <div>
     *      <span>{label}</span>
     *      <MyModel {...rest} />
     *     </div>
     *   );
     * ```
     */
    type FC<T extends Model, P extends {} = {}> = React.FC<Props<T> & P>;
  }
}

export declare namespace JSX {
  type ElementType = 
    | Model.Type<Model.Compat>
    | React.JSX.ElementType
    | ((props: {}, ref?: any) => void);

  type LibraryManagedAttributes<C, P> =
    // For normal class components, pull from props property explicitly because we dorked up ElementAttributesProperty.
    C extends new (...args: any[]) => { props: infer U } ? U :
    C extends Model.Type<infer U> ? Model.Props<U> :
    React.JSX.LibraryManagedAttributes<C, P>;

  interface Element extends React.JSX.Element {}
  interface ElementClass extends React.JSX.ElementClass {}
  // This is a hack to make TypeScript happy - React one insists on `props` property existing.
  // I await the "Find Out" phase of this experiment in git issues.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

function MC<T extends Model.Compat>(
  this: Model.Init<T>,
  { is, ...props }: Model.Props<T>
) {
  const model = this.use((self) => {
    self.set(props as Model.Assign<T>);

    if(is)
      is(self);
  });

  model.set(props as Model.Assign<T>);

  const render = METHOD.get(model.render) || props.render || model.render;
  const children = render
    ? render.call(model, props as Model.HasProps<T>, model)
    : props.children;

  return createProvider(model, children, props.fallback || model.fallback, String(model));
}

const RENDER = new WeakMap<Function, React.ComponentType>();

export function compat(
  this: (type: React.ElementType, ...args: any[]) => React.ReactElement,
  type: React.ElementType | Model.Init, ...args: any[]): React.ReactElement {

  if(typeof type == "function")
    if(RENDER.has(type))
      type = RENDER.get(type)!;
    else if(typeof type == "function")
      RENDER.set(type, type = (
        type.prototype instanceof Model ?
          MC.bind(type as Model.Init) :
        type as React.ComponentType
      ));

  return this(type, ...args);
}

export const jsx = compat.bind(Runtime.jsx);
export const jsxs = compat.bind(Runtime.jsxs);

export { Fragment } from "react";