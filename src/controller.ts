import {
  ControlProvider,
  getFromController,
  getFromControllerOrFail,
  ownContext,
  subscribeToController,
  tapFromController,
} from './context';
import { integrateExternalValues } from './dispatch';
import { controllerIsGlobalError, initGlobalController, useGlobalController } from './global';
import { ControlledInput, ControlledValue } from './hoc';
import { createWrappedComponent } from './provider';
import { useSubscriber } from './subscriber';
import { ModelController } from './types';
import { useOwnController } from './use_hook';
import { defineInitializer, defineValues } from './util';
import { useWatchedProperty, useWatcher } from './watcher';

const { defineProperty } = Object;

export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;
Controller.global = false;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

defineInitializer(prototype, "Provider", ControlProvider)
defineInitializer(prototype, "Value", ControlledValue)
defineInitializer(prototype, "Input", ControlledInput)

defineValues(prototype, {
  watch: integrateExternalValues,
  willDestroy: runCallback,
  sub: useSubscribeToThis,
  tap: useLiveThis,
})

defineProperty(Controller, "Provider", { get: getProvider });

defineValues(Controller, {
  use: useController,
  sub: subscribeToController,
  get: getFromController,
  has: getFromControllerOrFail,
  tap: tapFromController,
  hoc: createWrappedComponent,
  map: makeFromArray,
  makeGlobal: initGlobalController,
  context: getContext,
})

function makeFromArray(this: any, from: any[]){
  return from.map((item, index) => new this(item, index));
}

function returnThis(this: any){ 
  return this;
}

function runCallback(cb?: () => void){
  if(cb) cb();
}

function getContext(this: typeof ModelController){ 
  if(this.global)
    throw controllerIsGlobalError(this.name)
  else
    return ownContext(this)
}

function getProvider(this: typeof ModelController){
  if(this.global)
    throw controllerIsGlobalError(this.name)
  else 
    return useOwnController(this).Provider
}

function useController(
  this: typeof ModelController, ...args: any[]){

  return this.global
    ? useGlobalController(this, args)
    : useOwnController(this, args); 
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