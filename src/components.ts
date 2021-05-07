import type { Controller as Public } from '..';
import type { ComponentClass, ComponentType, FunctionComponent } from 'react';

import { createElement, useMemo, memo } from 'react';

import { useBindRef } from './binding';
import { Controller } from './controller';
import Oops from './issues';

export function boundRefComponent(
  control: Controller,
  property: string,
  Inner: Public.ComponentWithRef<HTMLElement>){

  return memo((props: {}) => {
    return Inner(props, useBindRef(control, property))
  })
}

export function withProvider(
  Component: ComponentType,
  control: Controller){

  return (props: any) =>
    createElement(control.Provider, {}, 
      createElement(Component, props)
    );
}

export function derivedConsumer<P extends {}>(
  Control: typeof Controller,
  Type: Public.Component<P>
): FunctionComponent<P> {

  const componentFor = createHocFactory(Type);

  return (props: any) => {
    const instance = Control.find();
    const Component = useMemo(() => componentFor(instance), []);
    
    return createElement(Component, props);
  }
}

export function derivedProvider<P extends {}>(
  Control: typeof Controller,
  Type: Public.Component<P>
): FunctionComponent<P> {
    
  const componentFor = createHocFactory(Type);

  function create(){
    const instance = Control.create();
    const HOC = componentFor(instance);

    return [ instance.Provider, HOC ];
  }

  return (props: any) => {
    const [ Provider, Component ] = useMemo(create, []);

    return createElement(Provider as any, null,
      createElement(Component as any, props) 
    );
  }
}

export function createHocFactory<T = any, P = {}>(
  Type: Public.Component<P>){

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype && Type.prototype.isReactComponent)
    return classTypeHOC<T, P>(Type as any);
  else
    return functionHOC<T, P>(Type as any);
}

function classTypeHOC<T, P>(Type: ComponentClass<P>){
  return (inject: T): ComponentClass<P> =>
    class extends Type {
      constructor(props: P){
        super(props, inject);
      }
    }
}

function functionHOC<T, P>(Type: FunctionComponent<P>){
  return (inject: T): FunctionComponent<P> =>
    (props: P) => Type(props, inject);
}