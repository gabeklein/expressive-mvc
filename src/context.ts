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
import { Map } from './polyfill';

const CONTEXT_ALLOCATED = new Map<Function, Context<ModelController>>();
const GLOBAL_ALLOCATED = new Map<Function, ModelController>();

const globalNotFoundError = (name: string) => new Error(
  `Controller ${name} is tagged as global. Instance must exist before use.`
)

const { 
  defineProperty: define,
  keys: keysIn,
  create: inheriting
} = Object;

export function useGlobalController(
  type: typeof ModelController,
  args: any[]){

  const global = GLOBAL_ALLOCATED.get(type);

  if(!global)
    throw globalNotFoundError(type.name)
    
  return useSubscriber(global, args, true);
}

export class DeferredPeerController {
  constructor(
    public controller: typeof ModelController
  ){}

  apply(){
    const global = GLOBAL_ALLOCATED.get(this.controller);

    if(!global)
      throw globalNotFoundError(this.controller.name);
  
    return global;
  }
}

export function usePeerController(
  from: typeof ModelController){

  const global = GLOBAL_ALLOCATED.get(from);

  if(global)
    return global;
  else if(from.global)
    return new DeferredPeerController(from);
  else 
    return ownContext(from);
}

export function ownContext(from: typeof ModelController){
  const constructor = getConstructor(from);
  let context = CONTEXT_ALLOCATED.get(constructor);

  if(!context){
    context = createContext(null as any);
    CONTEXT_ALLOCATED.set(constructor, context);
  }

  return context as Context<any>;
}

function getterFor(target: typeof ModelController){
  const global = GLOBAL_ALLOCATED.get(target);

  if(global)
    return () => global;
  else 
    return contextGetterFor(target)
}

function getConstructor(obj: any){
  if(obj.prototype)
    return obj.prototype.constructor;

  while(obj){
    obj = Object.getPrototypeOf(obj);
    if(obj.constructor)
      return obj.constructor;
  }
}

export function getFromControllerOrFail(
  this: typeof ModelController,
  key: string){

  const getInstance = getterFor(this)
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

  const getInstance = getterFor(this)
  const hook = key === undefined
    ? () => inheriting(getInstance())
    : (key: string) => (getInstance() as any)[key];

  define(this, `get`, { value: hook });
  return hook(key!) as unknown;
}

export function tapFromController(
  this: typeof ModelController, 
  key: string){

  const getInstance = getterFor(this);
  const hook = key === undefined
    ? () => useWatcher(getInstance())
    : (key: string) => useWatcherFor(key, getInstance())

  define(this, `tap`, { value: hook });
  return hook(key) as unknown;
}

export function subToController(
  this: typeof ModelController, 
  ...args: any[]){

  const getInstance = getterFor(this);
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

export function initGlobalController(this: typeof ModelController){
  this.global = true;
  const constructor = getConstructor(this);
  const instance = new this();

  GLOBAL_ALLOCATED.set(constructor, instance);
  return instance;
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
    let { children, className, style, ...rest } = props;

    if(keysIn(rest).length)
      controller.watch(rest);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}