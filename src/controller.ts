import { Context, FunctionComponentElement, ProviderProps } from 'react';

import { controllerCreateParent, getContext, watchFromContext, accessFromContext, getControlProvider, getHook } from './context';
import { Set } from './polyfill';
import { SpyController } from './subscriber';
import { applyExternal, ensureDispatch, DISPATCH, NEW_SUB, SOURCE } from './subscription';
import { BunchOf, Class, UpdateTrigger } from './types.d';
import { useOwnController } from './use_hook';

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
  
  static use<T extends Class>(this: T, ...args: any[]): InstanceType<T>;
  static get<T extends Class>(this: T): InstanceType<T>;
  static watch<T extends Class>(this: T): InstanceType<T>;
  static create<T extends Class>(this: T, ...args: any[]): FunctionComponentElement<any>; 
  static context(): Context<any>;
}

function returnThis<T = any>(this: T){ return this as T }

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

Controller.pull = watchFromContext;
Controller.context = getContext;
Controller.hook = getHook;
Controller.get = accessFromContext;

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
