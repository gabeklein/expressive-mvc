import { Context, createContext, createElement, PropsWithChildren, ProviderExoticComponent, useContext } from 'react';

import { Controller } from './controller';
import { globalController } from './global';
import { constructorOf, Map, define } from './util';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';
import { ModelController } from './types';
import { useWatchedProperty, useWatcher } from './watcher';

const CONTEXT_ALLOCATED = new Map<Function, Context<ModelController>>();

const { assign, keys: keysIn, create: inheriting } = Object;

export function retrieveController(
  from: ModelController | typeof ModelController,
  ...args: any[]){

  return from instanceof Controller ?
    useSubscriber(from as ModelController, args, false) :
    globalController(from as typeof ModelController, false) ||
    ownContext(from as typeof ModelController);
}

export function ownContext(from: typeof ModelController){
  const constructor = constructorOf(from);
  let context = CONTEXT_ALLOCATED.get(constructor);

  if(!context){
    context = createContext(null as any);
    CONTEXT_ALLOCATED.set(constructor, context);
  }

  return context as Context<any>;
}

function getterFor(target: typeof ModelController){
  const controller = globalController(target);

  return controller 
    ? () => controller 
    : contextGetterFor(target)
}

export function getFromControllerOrFail(
  this: typeof ModelController,
  key: string){

  const getInstance = getterFor(this)
  const hook = (key: string) =>
    useWatchedProperty(getInstance(), key, true);

  define(this, "has", hook);
  return hook(key) as unknown;
}

export function getFromController(
  this: typeof ModelController, 
  key?: string){

  const getInstance = getterFor(this)
  const hook = key === undefined
    ? () => inheriting(getInstance())
    : (key: string) => (getInstance() as any)[key];

  define(this, "get", hook);
  return hook(key!) as unknown;
}

export function tapFromController(
  this: typeof ModelController, 
  key: string,
  main?: boolean){

  const getInstance = getterFor(this);
  //TODO: Implement better caching here

  return key ?
    useWatchedProperty(getInstance(), key, main) :
    useWatcher(getInstance());
}

export function subscribeToController(
  this: typeof ModelController, 
  ...args: any[]){

  const getInstance = getterFor(this);
  const hook = (...args: any[]) => {
    const controller = getInstance();
    return useSubscriber(controller, args, false);
  }
  
  define(this, "sub", hook);
  return hook.apply(null, args);
}

export function ControlProvider(this: ModelController){
  const { Provider } = ownContext(this.constructor as any);
  return ParentProviderFor(this, Provider);
}

function contextGetterFor(
  target: typeof ModelController) {

  const { name } = target;
  
  const context = ownContext(target);

  function controllerFromContext(): ModelController {
    const instance = useContext(context) || useContext(CONTEXT_MULTIPROVIDER)[name];

    if(instance)
      return instance;

    throw new Error(
      `Can't subscribe to controller;` +
      ` this accessor can only be used within a Provider keyed to \`${name}\``
    );
  }

  return controllerFromContext;
} 

function ParentProviderFor(
  controller: ModelController,
  Provider: ProviderExoticComponent<any>): any {
    
  return (props: PropsWithChildren<any>) => {
    let { children, className, style } = props;

    props = assign({}, props);
    for(const k of ["children", "className", "style"])
      delete props[k];

    if(keysIn(props).length)
      controller.watch(props);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}