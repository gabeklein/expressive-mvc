import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  PropsWithChildren,
  ProviderProps,
  useContext,
  useMemo
} from 'react';

import { ModelController } from './controller';
import { useSubscriber } from './subscriber';
import { useController } from './use_hook';

const CONTEXT_ALLOCATED = [] as [Function, Context<ModelController>][];

const { 
  defineProperty: define,
  keys: keysIn
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
    context = createContext(constructor.prototype);
    CONTEXT_ALLOCATED.push([constructor, context]);
  }

  return context as Context<any>;
}

export function getFromContext(
  this: typeof ModelController){
    
  const context = ownContext(this);
 
  function useContextSubscriber(){
    const controller = useContext(context);
    return useSubscriber(controller);
  }
  
  define(this, `get`, { value: useContextSubscriber });
  return useContextSubscriber() as ModelController;
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
    return useSubscriber(controller);
  }
}

export function controllerCreateParent(
  this: typeof ModelController): any {

  const { Provider } = ownContext(this.constructor as any);

  return (props: PropsWithChildren<any>) => {
    let { children, className, style, ...rest } = props;
    let controller = useController(this);

    if(keysIn(rest).length)
      controller.watch(rest);

    if(typeof children == "function")
      children = useMemo(children, []);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: controller }, children);
  }
}

export function controllerCreateProvider(
  this: typeof ModelController, ...args: any[]): 
  FunctionComponentElement<ProviderProps<any>> {

  return useController(this, args).Provider;
}

export function getControlProvider(
  this: ModelController){

  const { Provider } = ownContext(this.constructor as any);
  const ControlProvider: any =
    (props: PropsWithChildren<any>) => 
      createElement(Provider, { value: this }, props.children);

  define(this, "Provider", { value: ControlProvider });
  return ControlProvider
}