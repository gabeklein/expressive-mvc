import type { ControllableRefFunction } from '..';
import type { ComponentClass, ComponentType, FunctionComponent } from 'react';

import { createElement, useMemo, memo } from 'react';

import { useBindRef } from './binding';
import { Controller } from './controller';
import Oops from './issues';

type HOCFactory<T> = (control: T) => ComponentType;

export function boundRefComponent(
  control: Controller,
  property: string,
  Inner: ControllableRefFunction<HTMLElement>){

  return memo((props: {}) => {
    return Inner(props, useBindRef(control, property))
  })
}

export function derivedConsumer(
  Control: typeof Controller,
  Type: ComponentType) {

  const componentFor = createHocFactory(Type);

  return (props: any) => {
    const instance = Control.find();
    const Component = useMemo(() => componentFor(instance), []);
    
    return createElement(Component, props);
  }
}

export function derivedProvider(
  Control: typeof Controller,
  Type: ComponentType){
    
  const componentFor = createHocFactory(Type);

  function create(){
    const instance = Control.create();
    const HOC = componentFor(instance);

    return [ instance.Provider, HOC ];
  }

  return (props: any) => {
    const [ Provider, Component ] = useMemo(create, []);

    return createElement(Provider, null,
      createElement(Component, props) 
    );
  }
}

export function createHocFactory<T = any>(
  Type: ComponentType): HOCFactory<T> {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype 
  && Type.prototype.isReactComponent)
    return (inject) => 
      class extends (Type as ComponentClass) {
        constructor(props: any){
          super(props, inject)
        }
      }
  else
    return (inject) =>
      (props: any) =>
        (Type as FunctionComponent)(props, inject);
}

export function withProvider(
  Component: ComponentType,
  control: Controller){

  return (props: any) =>
    createElement(control.Provider, {}, 
      createElement(Component, props)
    );
}