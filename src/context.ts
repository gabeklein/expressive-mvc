import { createContext, createElement, PropsWithChildren, ProviderExoticComponent, useContext } from 'react';

import { Controller } from './controller';
import { globalController, PeerController } from './global';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';

export const ASSIGNED_CONTEXT = Symbol("react_context");

export function retrieveController(
  from: Controller | typeof Controller,
  ...args: any[]){

  if(from instanceof Controller)
    return useSubscriber(from, args, false)
  else
    return new PeerController(from)
}

export function ownContext(from: typeof Controller){
  let context = from[ASSIGNED_CONTEXT];
  
  if(!context)
    context = from[ASSIGNED_CONTEXT] = createContext<Controller>(null as any);
      
  return context;
}

export function getterFor(target: typeof Controller, args: any[] = []){
  if(!target.global)
    return contextGetterFor(target);

  const controller = globalController(target, args);
  return () => controller;
}

export function ControlProvider(this: Controller){
  const { Provider } = ownContext(this.constructor as any);
  return ParentProviderFor(this, Provider);
}

function contextGetterFor(target: typeof Controller) {
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