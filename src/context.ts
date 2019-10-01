import {
  Context,
  createContext,
  createElement,
  PropsWithChildren,
  useContext,
} from 'react';

import { ModelController } from './controller';
import { useSubscriber } from './subscriber';

const CONTEXT_ALLOCATED = [] as [Function, Context<ModelController>][];

const { 
  defineProperty: define
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

export function getControlProvider(
  this: typeof ModelController){

  const context = ownContext(this.constructor as any);
  const ControlProvider: any =
    (props: PropsWithChildren<any>) => 
      createElement(
        context!.Provider,
        { value: this },
        props.children
      );

  define(this, "Provider", { value: ControlProvider });
  return ControlProvider
}