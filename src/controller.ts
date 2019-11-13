import { FunctionComponentElement, ProviderProps } from 'react';

import {
  accessFromContext,
  accessFromController,
  controllerCreateParent,
  getContext,
  getControlProvider,
  watchFromContext,
  watchFromController,
} from './context';
import { Set } from './polyfill';
import { SpyController } from './subscriber';
import { applyExternal, ensureDispatch } from './subscription';
import { BunchOf, UpdateTrigger } from './types.d';
import { useOwnController } from './use_hook';

export const NEW_SUB = "__init_subscription__";
export const UNSUBSCRIBE = "__delete_subscription__";
export const SUBSCRIBE = "__activate_subscription__";
export const DISPATCH = "__subscription_dispatch__";
export const SOURCE = "__subscription_source__";

const { 
  defineProperty: define 
} = Object;

export declare class ModelController { 

  local: BunchOf<any>;

  didInit?(): void;
  willDestroy(callback?: () => void): void;

  willRender?(...args: any[]): void;
  willMount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  didMount?(...args: any[]): void;
  willUnmount?(...args: any[]): void;

  elementWillRender?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementDidMount?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;

  componentWillRender?(): void;
  componentWillMount?(): void;
  componentWillUpdate?(): void;
  componentDidMount?(): void;
  componentWillUnmount?(): void;

  on(...args: string[]): this;
  not(...args: string[]): this;
  only(...args: string[]): this;
  once(): this;

  watch(props: BunchOf<any>): this;
  refresh(keys: string[]): void;
  
  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
  [SOURCE]: BunchOf<any>;
  [DISPATCH]: BunchOf<Set<UpdateTrigger>>;
  
  Provider: FunctionComponentElement<ProviderProps<this>>;
}

function returnThis(this: any){ return this }

/** Just the host function, nothing initialized here */
export function Controller(this: ModelController){
  if(this.didInit)
    setImmediate(() => this.didInit!())
}

const prototype = Controller.prototype = {} as any;

for(const f of ["on", "not", "only", "once"])
  prototype[f] = returnThis;

prototype.watch = applyExternal;
prototype.willDestroy = (cb?: () => void) => cb && cb();

define(prototype, NEW_SUB, {
  get: ensureDispatch,
  configurable: true
})

define(prototype, "Provider", {
  get: getControlProvider
})

Controller.fetch = accessFromContext;
Controller.watch = watchFromContext;
Controller.get = accessFromController;
Controller.tap = watchFromController;

Controller.sub = getContext;
Controller.context = getContext;

Controller.create = function 
  useOnce(...args: any[]){
    return useOwnController(this, args).once();
  }

Controller.use = function 
  use(...args: any[]){
    return useOwnController(this, args);
  }

define(Controller, "Provider", {
  get: controllerCreateParent 
})
