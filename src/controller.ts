import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  MutableRefObject,
  PropsWithChildren,
  ProviderProps,
  useContext,
  useEffect,
  useRef
} from 'react';

import { invokeLifecycle } from './helper';
import { SpyController, useSubscriber } from './subscriber';
import { ExpectsParams, Lifecycle, UpdateTrigger } from './types.d';
import { Dispatch, NEW_SUB } from './subscription';
import { bindMethods } from './use_hook';

const CACHE_CONTEXTS = new Map<typeof Controller, Context<Controller>>();

const { 
  defineProperty: define
} = Object;

export interface Controller {
  /* Force compatibility with <InstanceType> */
  new (...args: any): any;
  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
}

export class Controller {

  didMount?(): void;
  willUnmount?(): void;

  on(){ return this };
  not(){ return this };
  only(){ return this };
  once(){ return this };

  get set(){ return this }

  get Provider(): FunctionComponentElement<ProviderProps<this>> {
    let context = 
      CACHE_CONTEXTS.get(this.constructor as any);

    if(!context){
      const { name } = this.constructor;
      throw new Error(
        `\nNo accessor for class ${name} has been declared in your app; ` +  
        `this is required before using a corresponding Provider! ` + 
        `Run \`${name}.hook()\` and/or \`${name}.specificContext()\` within a module first.\n`
      );
    }

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

  static use<T extends ExpectsParams<A>, A extends any[]>
    (this: T, ...args: A){

    type I = InstanceType<T>;

    const ref = useRef(null) as MutableRefObject<I>

    if(ref.current === null){
      let instance = new this(...args);
      
      Dispatch.apply(instance);
      instance = bindMethods(instance, this.prototype, Controller.prototype);
      ref.current = instance as I;
    }

    useEffect(() => {
      const state = ref.current;
      const proto = this.prototype as Lifecycle;
      return invokeLifecycle(
        state, 
        state.didMount || proto.didMount, 
        state.willUnmount || proto.willUnmount
      );
    }, [])

    return useSubscriber(ref.current);
  }

  static specificContext<T extends Controller>(this: T){
    const { constructor } = this.prototype;
    let context = CACHE_CONTEXTS.get(constructor);

    if(!context){
      context = createContext(this.prototype);
      CACHE_CONTEXTS.set(constructor, context);
    }

    return context;
  }

  static hook<T extends Controller>(this: T){
    const context = (this as any).specificContext();

    return () => {
      const controller = useContext(context) as Controller | SpyController;
      return useSubscriber(controller) as InstanceType<T>;
    }
  }
}