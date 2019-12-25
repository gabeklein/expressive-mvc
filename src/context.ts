import {
  Context,
  createContext,
  createElement,
  PropsWithChildren,
  ProviderExoticComponent,
  useContext
} from 'react';

import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber, useWatcher, useWatcherFor } from './subscriber';
import { ModelController } from './types';

const CONTEXT_ALLOCATED = [] as [Function, Context<ModelController>][];

const { 
  defineProperty: define,
  keys: keysIn,
  create: inheriting
} = Object;

export function ownContext(from: typeof ModelController){
  let constructor;

  if(!from.prototype)
    do {
      from = Object.getPrototypeOf(from);
      constructor = from.constructor;
    }
    while(!constructor)
  else 
    constructor = from.prototype.constructor;

  let context;

  for(const [ _constructor, _context ] of CONTEXT_ALLOCATED)
    if(constructor === _constructor){
      context = _context;
      break; 
    }

  if(!context){
    context = createContext(null as any);
    CONTEXT_ALLOCATED.push([constructor, context]);
  }

  return context as Context<any>;
}

export function mustGetFromController(
  this: typeof ModelController,
  key: string){

  const getInstance = contextGetterFor(this)
  const hook = (key: string) => {
    const instance = getInstance();
    const value = (instance as any)[key];
    if(value === undefined)
      throw new Error(`${this.name}.${key} must be defined this render.`)
    return value;
  }
  define(this, `has`, { value: hook });
  return hook(key) as unknown;
}

export function getFromController(
  this: typeof ModelController, 
  key?: string){

  const getInstance = contextGetterFor(this)
  const hook = key === undefined
    ? () => inheriting(getInstance())
    : (key: string) => (getInstance() as any)[key];

  define(this, `get`, { value: hook });
  return hook(key!) as unknown;
}

export function tapFromController(
  this: typeof ModelController, 
  key: string){

  const getInstance = contextGetterFor(this);
  const hook = key === undefined
    ? () => useWatcher(getInstance())
    : (key: string) => useWatcherFor(key, getInstance())

  define(this, `tap`, { value: hook });
  return hook(key) as unknown;
}

export function subToController(
  this: typeof ModelController, 
  ...args: any[]){

  const getInstance = contextGetterFor(this);
  const hook = (...args: any[]) => {
    const controller = getInstance();
    return useSubscriber(controller, args);
  }
  
  define(this, `sub`, { value: hook });
  return hook.apply(null, args);
}

export function getControlProvider(
  this: ModelController){

  const { Provider } = ownContext(this.constructor as any);
  const ControlProvider = ParentProviderFor(this, Provider);

  define(this, "Provider", { value: ControlProvider });
  return ControlProvider
}

function contextGetterFor(
  target: typeof ModelController) {

  const { name } = target;
  const context = ownContext(target);

  function controllerFromContext(): ModelController {
    const instance = useContext(context) || useContext(CONTEXT_MULTIPROVIDER)[name];;

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
    let { children, className, style, ...rest } = props;

    if(keysIn(rest).length)
      controller.watch(rest);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}