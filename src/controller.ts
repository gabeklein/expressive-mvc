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

  didInit?(): void;

  willRender?(initial: boolean, local?: BunchOf<any>): void;
  willMount?(local?: BunchOf<any>): void;
  didMount?(local?: BunchOf<any>): void;
  willUnmount?(local?: BunchOf<any>): void;

  componentWillRender?(initial: true): void;
  componentWillMount?(): void;
  componentDidMount?(): void;
  componentWillUnmount?(): void;

  elementWillRender?(initial: boolean, local: BunchOf<any>): void;
  elementWillMount?(local: BunchOf<any>): void;
  elementDidMount?(local: BunchOf<any>): void;
  elementWillUnmount?(local: BunchOf<any>): void;

  on(...args: string[]): this;
  not(...args: string[]): this;
  only(...args: string[]): this;
  once(): this;

  watch(props: BunchOf<any>): this;
  refresh(keys: string[]): void;
  destroy(callback?: () => void): void;
  
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
prototype.destroy = (cb?: () => void) => cb && cb();

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
