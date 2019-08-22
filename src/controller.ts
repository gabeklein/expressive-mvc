import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  PropsWithChildren,
  ProviderProps,
  useContext,
} from 'react';

import { SpyController, useSubscriber } from './subscriber';
import { NEW_SUB, SUBSCRIBE } from './subscription';
import { ExpectsParams, UpdateTrigger } from './types.d';
import { useController } from './use_hook';

const CACHE_CONTEXTS = new Map<typeof Controller, Context<Controller>>();

const { 
  defineProperty: define
} = Object;

function ownContext<T extends Controller>(of: T){
  const { constructor } = of.prototype;
  let context = CACHE_CONTEXTS.get(constructor) as any;

  if(!context){
    context = createContext(of.prototype);
    CACHE_CONTEXTS.set(constructor, context);
  }

  return context as Context<T>;
}

interface Controller {
  /* Force compatibility with <InstanceType> */
  new (...args: any): any;
  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
}

class Controller {

  didMount?(): void;
  willUnmount?(): void;
  didHook?(): void;
  willHook?(): void;

  on(){ return this };
  not(){ return this };
  only(){ return this };
  once(){ return this };

  get Provider(): FunctionComponentElement<ProviderProps<this>> {
    const context = ownContext(this.constructor as any);

    const ControlProvider: any =
      (props: PropsWithChildren<any>) => 
        createElement(
          context!.Provider,
          { value: this },
          props.children
        );

    define(this, "Provider", { value: ControlProvider });
    return ControlProvider
  }

  static context<T extends Controller>(this: T){
    return ownContext(this as T);
  }

  static hook<T extends Controller>(this: T){
    const context = ownContext(this);

    return () => {
      const controller = useContext(context) as Controller | SpyController;
      return useSubscriber(controller) as InstanceType<T>;
    }
  }

  static create<T extends ExpectsParams<A>, A extends any[]>
    (this: T, ...args: A): FunctionComponentElement<ProviderProps<T>> {

    const control = 
      useController(this as any, args);

    return control.Provider;
  }

  static use<T extends ExpectsParams<A>, A extends any[]>
    (this: T, ...args: A): InstanceType<T> {

    const control = 
      useController(this as any, args);

    return useSubscriber(control);
  }

  static get<T extends ExpectsParams<any>>
    (this: T): InstanceType<T> {

    const context = ownContext(this as any);

    function useContextSubscriber(){
      const controller = useContext(context) as Controller | SpyController;
      return useSubscriber(controller);
    }
    
    define(this, `get`, { value: useContextSubscriber });
    return useContextSubscriber() as any;
  } 

  static useOnce(){
    return useController(this as any);
  }

  static useOn(...args: any){
    let state = this.use() as any;
    return SUBSCRIBE in state
      ? state.on(...args)
      : state;
  }

  static useOnly(...args: any){
    let state = this.use() as any;
    return SUBSCRIBE in state
      ? state.only(...args)
      : state;
  }

  static useExcept(...args: any){
    let state = this.use() as any;
    return SUBSCRIBE in state
      ? state.not(...args)
      : state;
  }

  static getOn(...args: any){
    let state = this.get() as any;
    return SUBSCRIBE in state
      ? state.on(...args)
      : state;
  }

  static getOnly(...args: any){
    let state = this.get() as any;
    return SUBSCRIBE in state
      ? state.only(...args)
      : state;
  }

  static getExcept(...args: any){
    let state = this.get() as any;
    return SUBSCRIBE in state
      ? state.not(...args)
      : state;
  }
}

define(Controller, "getOnce", {
  configurable: true,
  value: function(){
    const context = ownContext(this as any);
    const getFromContext = () =>
      useContext(context) as Controller | SpyController;

    define(this, `getOnce`, { 
      configurable: true,
      value: getFromContext
    });
    return getFromContext() as any;
  }
})

export { Controller }