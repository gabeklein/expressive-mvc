import type { ComponentClass, ComponentType, FunctionComponent } from 'react';
import { createElement } from 'react';

import { Controller } from './controller';
import Oops from './issues';

type HOCFactory = (control: Controller) => ComponentType;

export function createHocFactory(
  Type: ComponentType): HOCFactory {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  const proto = Type.prototype;
    
  if(proto && proto.isReactComponent)
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