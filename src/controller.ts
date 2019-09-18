import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  PropsWithChildren,
  ProviderProps,
  useContext,
} from 'react';

import { SpyController, useSubscriber } from './subscriber';
import { NEW_SUB, SUBSCRIBE } from './subscription';
import { ExpectsParams, UpdateTrigger } from './types.d';
import { useController } from './use_hook';

const CONTEXT_ALLOCATED = [] as Array<[typeof Controller, Context<Controller>]>;

const { 
  defineProperty: define
} = Object;

function ownContext<T extends Controller>(of: T){
  const { constructor } = of.prototype;
  let context;

  for(const [ _constructor, _context ] of CONTEXT_ALLOCATED)
    if(constructor === _constructor)
      context = _context;

  if(!context){
    context = createContext(of.prototype);
    CONTEXT_ALLOCATED.push([constructor, context]);
  }

  return context as Context<T>;
}

interface Controller {
  /* Force compatibility with <InstanceType> */
  new (...args: any): any;

  didMount?(): void;
  willUnmount?(): void;
  didHook?(): void;
  willHook?(): void;

  on(): this;
  not(): this;
  only(): this;
  once(): this;

  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
  Provider: FunctionComponentElement<ProviderProps<this>>;
}

interface TypeofController {
  new (...args: any[]): any;
  use<T extends ExpectsParams>(this: T, ...args: any[]): InstanceType<T>;
  get<T extends ExpectsParams>(this: T): InstanceType<T>;
}

function Controller(){}

Controller.prototype = {
  on(){ return this },
  not(){ return this },
  only(){ return this },
  once(){ return this }
};

define(Controller.prototype, "Provider", {
  get: function(): FunctionComponentElement<ProviderProps<Controller>> {
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
})

Controller.context = function context(this: any){
  return ownContext(this);
}

Controller.hook = function hook<T extends ExpectsParams>
  (this: any){
    
  const context = ownContext(this);

  return () => {
    const controller = useContext(context) as Controller | SpyController;
    return useSubscriber(controller) as InstanceType<T>;
  }
}

Controller.create = function create<T extends ExpectsParams<A>, A extends any[]>
  (this: T, ...args: A): FunctionComponentElement<ProviderProps<T>> {

  const control = 
    useController(this as any, args);

  return control.Provider;
}

Controller.use = function use<T extends ExpectsParams>
  (this: T, ...args: any[]): InstanceType<T> {

  const control = 
    useController(this as any, args);

  return useSubscriber(control);
}

Controller.get = function get<T extends ExpectsParams>
  (this: T): InstanceType<T> {

  const context = ownContext(this as any);

  function useContextSubscriber(){
    const controller = useContext(context) as Controller | SpyController;
    return useSubscriber(controller);
  }
  
  define(this, `get`, { value: useContextSubscriber });
  return useContextSubscriber() as any;
} 

Controller.useOnce = function useOnce(this: any){
  return useController(this);
}

Controller.useOn = function useOn(
  this: TypeofController, ...args: string[]){

  let state = this.use() as any;
  return SUBSCRIBE in state
    ? state.on(...args)
    : state;
}

Controller.useOnly = function useOnly(
  this: TypeofController, ...args: string[]){

  let state = this.use() as any;
  return SUBSCRIBE in state
    ? state.only(...args)
    : state;
}

Controller.useExcept = function useExcept(
  this: TypeofController, ...args: string[]){

  let state = this.use() as any;
  return SUBSCRIBE in state
    ? state.not(...args)
    : state;
}

Controller.getOn = function getOn(
  this: TypeofController, ...args: string[]){

  let state = this.get() as any;
  return SUBSCRIBE in state
    ? state.on(...args)
    : state;
}

Controller.getOnly = function getOnly(
  this: TypeofController, ...args: string[]){

  let state = this.get() as any;
  return SUBSCRIBE in state
    ? state.only(...args)
    : state;
}

Controller.getExcept = function getExcept(
  this: TypeofController, ...args: string[]){

  let state = this.get() as any;
  return SUBSCRIBE in state
    ? state.not(...args)
    : state;
}

Controller.getOnce = function getOnce(
  this: TypeofController, ...args: string[]){

  const context = ownContext(this as any);
  const getFromContext = () =>
    useContext(context) as Controller | SpyController;

  define(this, `getOnce`, { 
    configurable: true,
    value: getFromContext
  });
  
  return getFromContext() as any;
}

export { Controller }