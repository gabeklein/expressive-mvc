import {
  ControlProvider,
  getFromController,
  getFromControllerOrFail,
  ownContext,
  subToController,
  tapFromController,
} from './context';
import { integrateExternalValues } from './dispatch';
import { controllerIsGlobalError, initGlobalController, useGlobalController } from './global';
import { ControlledInput, ControlledValue } from './hoc';
import { defineInitializer } from './polyfill';
import { createWrappedComponent } from './provider';
import { useSubscriber, useWatchedProperty, useWatcher } from './subscriber';
import { ModelController } from './types';
import { useOwnController } from './use_hook';

const { defineProperties: define } = Object;

export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

define(prototype, {
  watch: { value: integrateExternalValues },
  willDestroy: { value: runCallback },
  sub: { value: useSubscribeToThis },
  tap: { value: useLiveThis },
})

defineInitializer(prototype, "Provider", ControlProvider)
defineInitializer(prototype, "Value", ControlledValue)
defineInitializer(prototype, "Input", ControlledInput)

define(Controller, {
  use: { value: useController },
  sub: { value: subToController },
  get: { value: getFromController },
  has: { value: getFromControllerOrFail },
  tap: { value: tapFromController },
  hoc: { value: createWrappedComponent },
  map: { value: makeFromArray },
  makeGlobal: { value: initGlobalController },
  context: { value: getContext },
  Provider: { get: getProvider },
  global: { value: false, writable: true }
})

function makeFromArray(this: any, from: any[]){
  return from.map((item, index) => new this(item, index))
}

function returnThis(this: any){ 
  return this
}

function runCallback(cb?: () => void){
  if(cb) cb()
}

function getContext(this: typeof ModelController){ 
  if(this.global)
    throw controllerIsGlobalError(this.name)

  return ownContext(this)
}

function getProvider(this: typeof ModelController){
  if(this.global)
    throw controllerIsGlobalError(this.name)
    
  return useOwnController(this).Provider
}

function useController(
  this: typeof ModelController, ...args: any[]){

  if(this.global)
    return useGlobalController(this, args)
  else 
    return useOwnController(this, args) 
}

function useSubscribeToThis(
  this: ModelController, ...args: any[]){
    
  return useSubscriber(this, args, true) 
}

function useLiveThis(
  this: ModelController, key?: string, main?: boolean){

  return key 
    ? useWatchedProperty(this, key, main) 
    : useWatcher(this);
}