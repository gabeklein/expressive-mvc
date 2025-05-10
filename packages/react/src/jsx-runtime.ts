import { Model } from '@expressive/mvc';
import { jsx, jsxs } from 'react/jsx-runtime';

import { Provider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
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
  props: Model.Props<T>
){
  const { is, ...rest } = props;

  return jsx(Provider, {
    for: this,
    forEach: is,
    children: jsx(() => {
      const self = this.get();
  
      Object.assign(Object.create(self.is), rest);

      const render = props.render || self.render;

      if(render)
        return jsx(() => render(props, render.length > 1 && this.get() as any), {});

      return props.children;
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