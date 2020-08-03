import { createContext, createElement, PropsWithChildren, ProviderExoticComponent, useContext } from 'react';

import { Controller } from './controller';
import { CONTEXT_MULTIPROVIDER } from './provider';

export const OWN_CONTEXT = Symbol("react_context");

export function ownContext(model: typeof Controller){
  let context = model[OWN_CONTEXT];
  
  if(!context)
    context = model[OWN_CONTEXT] = createContext<Controller>(null as any);
      
  return context;
}

export function contextGetterFor(target: typeof Controller) {
  const { name } = target;
  
  const context = ownContext(target);

  function controllerFromContext(): Controller {
    const instance = useContext(context) || useContext(CONTEXT_MULTIPROVIDER)[name];

    if(instance)
      return instance;

    throw new Error(
      `Can't subscribe to controller; this accessor ` + 
      `can only be used within a Provider keyed to \`${name}\``
    );
  }

  return controllerFromContext;
}

export function ControlProvider(this: Controller){
  const { Provider } = ownContext(this.constructor as any);
  return ParentProviderFor(this, Provider);
}

function ParentProviderFor(
  controller: Controller,
  Provider: ProviderExoticComponent<any>): any {
    
  return (props: PropsWithChildren<any>) => {
    let { children, className, style } = props;

    props = Object.assign({}, props);
    for(const k of ["children", "className", "style"])
      delete props[k];

    if(Object.keys(props).length)
      controller.assign(props);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}