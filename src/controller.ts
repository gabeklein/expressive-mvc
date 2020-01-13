import { getControlProvider, getFromController, ownContext, subToController, tapFromController, mustGetFromController } from './context';
import { applyExternal, ensureDispatch, NEW_SUB } from './dispatch';
import { createWrappedComponent } from './provider';
import { ModelController } from './types';
import { useOwnController } from './use_hook';
import { useAccessorComponent } from './accessor';
import { useSubscriber, useWatcher, useWatcherFor } from './subscriber';

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
  has: { value: mustGetFromController },
  tap: { value: tapFromController },
  hoc: { value: createWrappedComponent },
  context: { value: getContext },
  Provider: { get: getProvider }
})

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

function useController(this: typeof ModelController, ...args: any[]){
  return useOwnController(this, args) 
}

function useSubscribeToThis(this: ModelController, ...args: any[]){
  return useSubscriber(this, args) 
}

function useLiveThis(this: ModelController, key?: string){
  if(key) return useWatcherFor(key, this);
  else return useWatcher(this) 
}