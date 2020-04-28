import { Context, createContext, createElement, PropsWithChildren, ProviderExoticComponent, useContext } from 'react';

import { Controller } from './controller';
import { globalController } from './global';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';
import { constructorOf, Map } from './util';

const CONTEXT_ALLOCATED = new Map<Function, Context<Controller>>();

const { assign, keys: keysIn } = Object;

export function retrieveController(
  from: Controller | typeof Controller,
  ...args: any[]){

  if(from instanceof Controller)
    return useSubscriber(from as Controller, args, false)
  else
    return (
      globalController(from as typeof Controller, true) ||
      ownContext(from as typeof Controller)
    );
}

export function ownContext(from: typeof Controller){
  const constructor = constructorOf(from);
  let context = CONTEXT_ALLOCATED.get(constructor);

  if(!context){
    context = createContext(null as any);
    CONTEXT_ALLOCATED.set(constructor, context);
  }

  return context as Context<Controller>;
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