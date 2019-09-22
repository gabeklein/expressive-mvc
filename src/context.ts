import {
  Context,
  createContext,
  useContext,
} from 'react';

import { ModelController } from './controller';
import { useSubscriber } from './subscriber';

const CONTEXT_ALLOCATED = [] as Array<[Function, Context<ModelController>]>;

const { 
  defineProperty: define
} = Object;

function ownContext(of: typeof ModelController){
  const { constructor } = of.prototype;
  let context;

  for(const [ _constructor, _context ] of CONTEXT_ALLOCATED)
    if(constructor === _constructor){
      context = _context;
      break; 
    }

  if(!context){
    context = createContext(of.prototype);
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

  const context = ownContext(this);

  function useContextSubscriber(){
    const controller = useContext(context);
    return useSubscriber(controller);
  }

  define(this, `get`, { value: useContextSubscriber });
  return useContextSubscriber();
} 