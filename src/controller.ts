import { FunctionComponentElement, ProviderProps, useContext, Context } from 'react';

import { getContext, getControlProvider, getHook, getFromContext, controllerCreateProvider, controllerCreateParent } from './context';
import { SpyController, useSubscriber } from './subscriber';
import { NEW_SUB, SUBSCRIBE } from './subscription';
import { UpdateTrigger, Class, BunchOf } from './types.d';
import { useController } from './use_hook';

const { 
  defineProperty: define 
} = Object;

declare class ModelController {

  didMount?(): void;
  willUnmount?(): void;
  didHook?(): void;
  willHook?(): void;

  on(...args: string[]): this;
  not(...args: string[]): this;
  only(...args: string[]): this;
  once(): this;

  watch(props: BunchOf<any>): this;

  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
  Provider: FunctionComponentElement<ProviderProps<this>>;

  static use<T extends Class>(this: T, ...args: any[]): InstanceType<T>;
  static get<T extends Class>(this: T): InstanceType<T>;
  static create<T extends Class>(this: T, ...args: any[]): FunctionComponentElement<any>; 
  static context(): Context<any>;
}

function returnThis<T = any>(this: T){ return this as T }

/** Just the host function, nothing initialized here */
function Controller(){}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis

define(prototype, "Provider", {
    get: getControlProvider
})

define(Controller, "Provider", {
    get: controllerCreateParent 
})

Controller.context = getContext;
Controller.hook = getHook;
Controller.get = getFromContext;
Controller.create = controllerCreateProvider;

Controller.use = function use(...args: any[]){
  const control = useController(this, args);
  return useSubscriber(control);
}

Controller.useOnce = function useOnce(){
  return useController(this);
}

Controller.useOn = function useOn(
  this: typeof ModelController, ...args: string[]){

  let state = this.use();
  return SUBSCRIBE in state
    ? state.on(...args)
    : state;
}

Controller.useOnly = function useOnly(
  this: typeof ModelController, ...args: string[]){

  let state = this.use();
  return SUBSCRIBE in state
    ? state.only(...args)
    : state;
}

Controller.useExcept = function useExcept(
  this: typeof ModelController, ...args: string[]){

  let state = this.use();
  return SUBSCRIBE in state
    ? state.not(...args)
    : state;
}

Controller.getOn = function getOn(
  this: typeof ModelController, ...args: string[]){

  let state = this.get();
  return SUBSCRIBE in state
    ? state.on(...args)
    : state;
}

Controller.getOnly = function getOnly(
  this: typeof ModelController, ...args: string[]){

  let state = this.get();
  return SUBSCRIBE in state
    ? state.only(...args)
    : state;
}

Controller.getExcept = function getExcept(
  this: typeof ModelController, ...args: string[]){

  let state = this.get();
  return SUBSCRIBE in state
    ? state.not(...args)
    : state;
}

Controller.getOnce = function getOnce(
  this: typeof ModelController, ...args: string[]){

  const properContext = this.context();
  const getFromContext = () => useContext(properContext);

  define(this, "getOnce", { 
      configurable: true,
      value: getFromContext
  });
  
  return getFromContext();
}

export { Controller, ModelController }