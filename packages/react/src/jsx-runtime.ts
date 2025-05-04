import { Model } from '@expressive/mvc';
import { jsx, jsxs } from 'react/jsx-runtime';

import { Provider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
    type Render<T extends Model> = (this: T, self: T) => React.ReactNode;

    namespace FC {
      type Extends <T extends Model, P extends {} = {}> = Props<T> & P;

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
      render?(props: Model.Assign<this>, self: this): React.ReactNode;
      children?: React.ReactNode;
    }

    type Props<T extends Model> = 
      & T extends { render(props: infer P, self: any): any }
        ? Partial<Pick<T, Exclude<keyof T, keyof Model | "render">>> & P
        : Partial<Pick<T, Exclude<keyof T, keyof Model>>> & {
          children?: React.ReactNode | Render<T>;
        }
      & {
        /**
         * Callback for newly created instance. Only called once.
         * @returns Callback to run when instance is destroyed.
         */
        is?: (instance: T) => void | (() => void);
      };
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
  // I await the "Find Out" phase of this experiment in git issues.
  interface ElementAttributesProperty {}
  interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}

  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
}

function Component<T extends Model.Compat>(
  this: Model.Type<T>,
  props: Model.Assign<T>
){
  const { is, ...rest } = props;

  return jsx(Provider, {
    for: this,
    forEach: is,
    children: jsx(() => {
      const self = this.get();
      const { render } = self;
  
      for(const key in rest)
        if(key in self)
          (self as any)[key] = rest[key];

      if(render)
        return jsx(() => {
          const self = this.get();
          return render.call(self, props, self);
        }, {});

      const { children } = self;

      if(children)
        return children;

      const fn = props.children as React.ReactNode | Model.Render<T>;

      if(typeof fn != "function")
        return fn;

      return jsx(() => {
        const self = this.get();
        return fn.call(self, self);
      }, {});
    }, {})
  });
}

const RENDER = new WeakMap<typeof Model, React.FC>();

export function compat(type: React.ElementType | Model.Type){
  const bound = RENDER.get(type as any);

  if(bound) return bound;

  if(Model.is(type))
    RENDER.set(type, type = Component.bind(type));

  return type;
}

function jsx2(
  type: React.ElementType | Model.Type,
  props: Record<string, any>,
  key?: React.Key) {
  
  return jsx(compat(type), props, key);
}

function jsxs2(
  type: React.ElementType | Model.Type,
  props: Record<string, any>,
  key?: React.Key) {
  
  return jsxs(compat(type), props, key);
}

export { Fragment } from "react";
export {
  jsx2 as jsx,
  jsxs2 as jsxs
}