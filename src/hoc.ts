import type { Controller as Public } from '../types';
import type { ComponentClass, ComponentType, FunctionComponent } from 'react';

import { createElement, useMemo } from 'react';

import { useBindRef } from './binding';
import { Provider } from './context';
import { Controller } from './controller';
import Oops from './issues';

export function boundRefComponent(
  control: Controller,
  property: string,
  Inner: Public.Component<{}, any>){

  const componentFor = createHocFactory(Inner);

  return (props: {}) => {
    const ref = useBindRef(control, property);
    const Component = useMemo(() => componentFor(ref), []);

    return createElement(Component, props);
  }
}

export function withProvider(
  Component: ComponentType,
  control: Controller){

  return (props: any) =>
    createElement(Provider, { of: control }, 
      createElement(Component, props)
    );
}

export function createHocFactory<T = any, P = {}>(
  Type: Public.Component<P, T>
): (inject: T) => ComponentType<P> {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype && Type.prototype.isReactComponent)
    return classTypeHOC<T, P>(Type as any);
  else
    return functionHOC<T, P>(Type as any);
}

function classTypeHOC<T, P>(Type: ComponentClass<P>){
  return (inject: T) =>
    class extends Type {
      constructor(props: P){
        super(props, inject);
      }
    }
}

function functionHOC<T, P>(Type: FunctionComponent<P>){
  return (inject: T) =>
    (props: P) => Type(props, inject);
}