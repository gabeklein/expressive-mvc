import type { ComponentClass, ComponentType, FunctionComponent } from 'react';
import { createElement, useMemo } from 'react';

import { Controller } from './controller';
import Oops from './issues';

type HOCFactory = (control: Controller) => ComponentType;

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

export function createHocFactory(
  Type: ComponentType): HOCFactory {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype 
  && Type.prototype.isReactComponent)
    return (control) => 
      class extends (Type as ComponentClass) {
        constructor(props: any){
          super(props, control)
        }
      }
  else
    return (control) =>
      (props: any) =>
        (Type as FunctionComponent)(props, control);
}

export function withProvider(
  Component: ComponentType,
  control: Controller){

  return (props: any) =>
    createElement(control.Provider, {}, 
      createElement(Component, props)
    );
}