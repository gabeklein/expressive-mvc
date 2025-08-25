import { Context, createEffect, METHOD, Model } from '@expressive/mvc';
import React from 'react';
import Runtime from 'react/jsx-runtime';

import { createProvider } from './context';
import { Pragma } from './adapter';

declare module "@expressive/mvc" {
  namespace Model {
    namespace FC {
      type Extends<T extends Model, P extends {} = {}> = Props<T> & P;

      export { Extends as Props };
    }

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
    type FC<T extends Model, P extends {} = {}> = React.FC<FC.Props<T, P>>;

    /** Model which is not incompatable as Component in React. */
    interface Compat extends Model {
      render?(props: HasProps<this>, self: this): React.ReactNode;
    }

    interface BaseProps<T extends Model> {
      /**
       * Callback for newly created instance. Only called once.
       * @returns Callback to run when instance is destroyed.
       */
      is?: (instance: T) => void | (() => void);

      render?(props: HasProps<T>, self: T): React.ReactNode;
    }

    type HasProps<T extends Model> = Partial<Pick<T, Exclude<keyof T, keyof Model>>>;

    type Props<T extends Model> = 
      T extends { render(props: infer P, self: any): any }
        ? BaseProps<T> & HasProps<T> & P
        : BaseProps<T> & HasProps<T> & { children?: React.ReactNode };
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

function TC<T extends Model.Compat>(
  this: Model.Init<T>,
  props: Model.Props<T>
) {
  const local = this.use((self) => {
    self.set(props as Model.Assign<T>);

    if(props.is)
      return props.is(self);
  });

  local.set(props as Model.Assign<T>);

  const render = METHOD.get(local.render) || props.render;

  return createProvider(
    Context.get(local)!,
    render ? render.call(local, props as Model.HasProps<T>, local) : props.children
  );
}

function MC<T extends Model.Compat>(this: T, props: Model.Props<T>){
  const r = Pragma.useFactory((refresh) => {
    let element: React.ReactNode;
    let ready: boolean | undefined;

    createEffect(this, self => {
      const render = METHOD.get(this.render) || self.render;

      element = createProvider(
        Context.get(this)!,
        render ? render.call(self, props as Model.HasProps<T>, self) : props.children
      );

      if(ready)
        refresh();
    })

    function didMount(){
      ready = true;
      return () => {};
    }

    return (p: Model.Props<T>) => {
      this.set(props as Model.Assign<T>);
      const render = METHOD.get(this.render) || p.render;
      Pragma.useLifecycle(didMount);

      return createProvider(
        Context.get(this)!,
        render ? render.call(this, props as Model.HasProps<T>, this) : props.children
      );
    }
  })

  return r(props);
}

const RENDER = new WeakMap<Function | Model, React.ComponentType>();

export function compat(
  this: (type: React.ElementType, ...args: any[]) => React.ReactElement,
  type: React.ElementType | Model.Init | Model.Compat, ...args: any[]): React.ReactElement {

  if(type instanceof Model)
    type = MC.bind(type);
  else if(typeof type == "function")
    if(RENDER.has(type))
      type = RENDER.get(type)!;
    else if(typeof type == "function")
      RENDER.set(type, type = (
        type.prototype instanceof Model ?
          TC.bind(type as Model.Init) :
        type as React.ComponentType
      ));

  return this(type, ...args);
}

export const jsx = compat.bind(Runtime.jsx);
export const jsxs = compat.bind(Runtime.jsxs);

export { Fragment } from "react";