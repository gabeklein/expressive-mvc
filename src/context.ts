import { createContext, createElement, PropsWithChildren, ProviderExoticComponent, useContext } from 'react';

import { Controller } from './controller';
import { DeferredPeerController, GLOBAL_INSTANCE, globalController } from './global';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';

const { assign, keys: keysIn } = Object;

export const ASSIGNED_CONTEXT = Symbol("react_context");

export function retrieveController(
  from: Controller | typeof Controller,
  ...args: any[]){

  if(from instanceof Controller)
    return useSubscriber(from, args, false)
  
  return (
    from[GLOBAL_INSTANCE] ||
    new DeferredPeerController(from)
  )
}

export function ownContext(from: typeof Controller){
  let context = from[ASSIGNED_CONTEXT];
  
  if(!context)
    context = from[ASSIGNED_CONTEXT] = createContext<Controller>(null as any);
      
  return context;
}

export function getterFor(target: typeof Controller){
  const controller = globalController(target);

  return controller 
    ? () => controller 
    : contextGetterFor(target)
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
      `Can't subscribe to controller; this accessor can only be used within a Provider keyed to \`${name}\``
    );
  }

  return controllerFromContext;
} 

function ParentProviderFor(
  controller: Controller,
  Provider: ProviderExoticComponent<any>): any {
    
  return (props: PropsWithChildren<any>) => {
    let { children, className, style } = props;

    props = assign({}, props);
    for(const k of ["children", "className", "style"])
      delete props[k];

    if(keysIn(props).length)
      controller.assign(props);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}