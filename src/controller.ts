import { useAccessorComponent } from './accessor';
import {
  getControlProvider,
  getFromController,
  getFromControllerOrFail,
  initGlobalController,
  ownContext,
  subToController,
  tapFromController,
} from './context';
import { applyExternal, ensureDispatch, NEW_SUB } from './dispatch';
import { createWrappedComponent } from './provider';
import { useSubscriber, useWatcher, useWatcherFor } from './subscriber';
import { ModelController } from './types';
import { useOwnController } from './use_hook';

const {
  defineProperties: define
} = Object;

export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

prototype.watch = applyExternal;
prototype.willDestroy = runCallback;

define(prototype, {
  [NEW_SUB]: {
    get: ensureDispatch,
    configurable: true
  },
  sub: { value: useSubscribeToThis },
  tap: { value: useLiveThis },
  Provider: { get: getControlProvider },
  Value: { get: useAccessorComponent }
})

define(Controller, {
  use: { value: useController },
  sub: { value: subToController },
  get: { value: getFromController },
  has: { value: getFromControllerOrFail },
  tap: { value: tapFromController },
  hoc: { value: createWrappedComponent },
  makeGlobal: { value: initGlobalController },
  singleton: { value: createSingletonAccess },
  context: { value: getContext },
  Provider: { get: getProvider }
})

function createSingletonAccess(this: typeof ModelController){
  const instance = new this();
  return {
    sub: (...args: any[]) => useSubscriber(instance, args),
    get: (key?: string) => key ? (instance as any)[key] : instance,
    tap: (key?: string) => key ? useWatcherFor(key, instance) : useWatcher(instance),
    has: (key: string) => {
      const value = (instance as any)[key];
      if(!value)
        throw new Error(`${this.name}.${key} must be defined when this component renders.`);
      return value;
    }
  }
}

function returnThis(this: any){ 
  return this
}

function runCallback(cb?: () => void){
  if(cb) cb()
}

function getContext(this: typeof ModelController){ 
  return ownContext(this)
}

function getProvider(this: typeof ModelController){
  return useOwnController(this).Provider
}

function useController(
  this: typeof ModelController, ...args: any[]){

  return useOwnController(this, args) 
}

function useSubscribeToThis(
  this: ModelController, ...args: any[]){
    
  return useSubscriber(this, args) 
}

function useLiveThis(
  this: ModelController, key?: string){
    
  if(key) return useWatcherFor(key, this);
  else return useWatcher(this) 
}