import { FunctionComponentElement, ProviderProps, useContext, Context } from 'react';

import { getContext, getControlProvider, getHook, getFromContext } from './context';
import { SpyController, useSubscriber } from './subscriber';
import { NEW_SUB, SUBSCRIBE } from './subscription';
import { ExpectsParams, UpdateTrigger } from './types.d';
import { useController } from './use_hook';

const { 
  defineProperty: define
} = Object;

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
  context(): Context<any>;
}

function Controller(){}

Controller.prototype = {
  on(){ return this },
  not(){ return this },
  only(){ return this },
  once(){ return this }
};

define(prototype, "Provider", {
  get: getControlProvider
})

Controller.context = getContext;
Controller.hook = getHook;
Controller.get = getFromContext;

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

  const context = this.context();
  const getFromContext = () =>
    useContext(context) as Controller | SpyController;

  define(this, `getOnce`, { 
    configurable: true,
    value: getFromContext
  });
  
  return getFromContext() as any;
}

export { Controller }