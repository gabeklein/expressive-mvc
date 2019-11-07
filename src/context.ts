import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  PropsWithChildren,
  ProviderExoticComponent,
  ProviderProps,
  useContext
} from 'react';

import { ModelController } from './controller';
import { useSubscription } from './subscriber';
import { useOwnController } from './use_hook';
import { findInMultiProvider } from './provider';

const CONTEXT_ALLOCATED = [] as [Function, Context<ModelController>][];

const { 
  defineProperty: define,
  keys: keysIn,
  create
} = Object;

function ownContext(from: typeof ModelController){
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

export function watchFromContext(this: typeof ModelController, ...args: any[]){
  let context = ownContext(this);
 
  const find = (...args: any[]) => useSubscription(
    useContext(context) || findInMultiProvider(this.name), args
  );
  
  define(this, `pull`, { value: find });
  return find.apply(null, args) as ModelController;
}

export function accessFromContext(this: typeof ModelController, ...args: any[]){
  let context = ownContext(this);

  const find = () => create(
    useContext(context) || findInMultiProvider(this.name)
  );

  define(this, `get`, { value: find });
  return find() as ModelController;
}

export function getContext(
  this: typeof ModelController){

  return ownContext(this);
}

export function getHook(
  this: typeof ModelController){

  const context = ownContext(this);

  return () => {
    const controller = useContext(context);
    return useSubscription(controller, []);
  }
}

export function controllerCreateParent(
  this: typeof ModelController): any {

  const memoizedProvider = () => useOwnController(this).Provider;

  define(this, "Provider", { get: memoizedProvider });

  return memoizedProvider();
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

export function controllerCreateProvider(
  this: typeof ModelController, ...args: any[]): 
  FunctionComponentElement<ProviderProps<any>> {

  return useOwnController(this, args).Provider;
}

export function getControlProvider(
  this: ModelController){

  const { Provider } = ownContext(this.constructor as any);
  const ControlProvider = ParentProviderFor(this, Provider);

  define(this, "Provider", { value: ControlProvider });
  return ControlProvider
}