import { Model } from '@expressive/mvc';
import { jsx, jsxs } from 'react/jsx-runtime';

import { Provider } from './context';

declare module '@expressive/mvc' {
  namespace Model {
    type Render<T extends Model> = (this: T, self: T) => React.ReactNode;

    /** Model which is not incompatable as Component in React. */
    interface Compat extends Model {
      render?(props: Model.Assign<this>, self: this): React.ReactNode;
      children?: React.ReactNode;
    }

    type Props<T extends Model> = 
      & T extends { render(props: infer P): any }
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

function Render<T extends Model.Compat>(
  this: Model.Init<T>,
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

export function create(
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
    const bound = RENDER.get(type);

    if(bound)
      type = bound;
    else
      RENDER.set(type, type = Render.bind(type as Model.Init));
  }
    
  return this(type, props, key, ...args);
}

const jsx2 = create.bind(jsx);
const jsxs2 = create.bind(jsxs);

export { Fragment } from "react";
export {
  jsx2 as jsx,
  jsxs2 as jsxs
}