import {
  ControlProvider,
  getFromController,
  getFromControllerOrFail,
  ownContext,
  subscribeToController,
  tapFromController,
} from './context';
import { integrateExternal } from './dispatch';
import { controllerIsGlobalError, initGlobalController, useGlobalController } from './global';
import { ControlledInput, ControlledValue } from './hoc';
import { createWrappedComponent } from './provider';
import { useSubscriber } from './subscriber';
import { ModelController } from './types';
import { useOwnController } from './use_hook';
import { defineOnAccess, define } from './util';
import { useWatchedProperty, useWatcher } from './watcher';

export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

bootstrapController(Controller);

export function bootstrapController(fn: any){
  const noop = function(this: any){ return this };

  const prototype = Controller.prototype = {} as any;
  fn.global = false;

  for(const f of ["on", "not", "only", "once"])
    prototype[f] = noop;

  defineOnAccess(prototype, "Provider", ControlProvider)
  defineOnAccess(prototype, "Value", ControlledValue)
  defineOnAccess(prototype, "Input", ControlledInput)

  define(prototype, {
    constructor: fn,
    onChange: handleOnChange,
    apply: integrateExternal,
    willDestroy: runCallback,
    sub: useSubscribeToThis,
    tap: useLiveThis,
  })

  Object.defineProperty(fn, "Provider", { get: getProvider })

  define(fn, {
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
}

function makeFromArray(this: any, from: any[]){
  return from.map((item, index) => new this(item, index));
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

  return this.global ? 
    useGlobalController(this, args) : 
    useOwnController(this, args); 
}

function useSubscribeToThis(
  this: ModelController, ...args: any[]){

  return useSubscriber(this, args, true) 
}

function handleOnChange(
  this: ModelController, 
  key: string | string[], 
  listener?: (changed: string[]) => void){

  if(listener)
    this.observe(key as any, listener, true);
  else {
    return new Promise(resolve => {
      this.observe(key as any, resolve, true);
    })
  }
}

function useLiveThis(
  this: ModelController, key?: string, main?: boolean){

  return key ? 
    useWatchedProperty(this, key, main) : 
    useWatcher(this);
}