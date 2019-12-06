import {
  getControlProvider,
  getFromController,
  ownContext,
  subToController,
  tapFromController,
} from './context';
import { applyExternal, ensureDispatch, NEW_SUB } from './dispatch';
import { createWrappedComponent } from './provider';
import { ModelController } from './types';
import { useOwnController } from './use_hook';

const { 
  defineProperty: define 
} = Object;

function returnThis(this: any){ return this }
function getContext(this: typeof ModelController){ return ownContext(this) }

/** Just the host function, nothing initialized here */
export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

prototype.watch = applyExternal;
prototype.willDestroy = function(cb?: () => void){ if(cb) cb() };

define(prototype, NEW_SUB, {
  get: ensureDispatch,
  configurable: true
})

define(prototype, "Provider", {
  get: getControlProvider
})

Controller.sub = subToController;
Controller.get = getFromController;
Controller.tap = tapFromController;

Controller.context = getContext;
Controller.hoc = createWrappedComponent;

Controller.new = function (...args: any[]){
  return useOwnController(this, args).once();
}

Controller.use = function 
  use(...args: any[]){
    return useOwnController(this, args);
  }

define(Controller, "Provider", {
  get(){ return useOwnController(this).Provider }
})
