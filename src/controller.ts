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
import { Dispatch, NEW_SUB, SUBSCRIBE } from './subscription';
import { bindMethods } from './use_hook';

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

function useController<T extends Controller>( 
  control: T,
  args: any[] = []){

  type I = InstanceType<T>;

  const cache = useRef(null) as MutableRefObject<I>
  let instance = cache.current as InstanceType<T>;

  if(instance === null){
    instance = new control(...args);
    Dispatch.apply(instance);
    instance = bindMethods(instance, control.prototype, Controller.prototype);
    cache.current = instance;
  }

  useEffect(() => {
    const state = instance;
    const proto = control.prototype as Lifecycle;
    return invokeLifecycle(
      state, 
      state.didMount || proto.didMount, 
      state.willUnmount || proto.willUnmount
    );
  }, [])

  return instance;
}

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
    (this: T, ...args: A): InstanceType<T> {

    const control = 
      useController(this as any, args);

    return useSubscriber(control);
  }

  static create<T extends ExpectsParams<A>, A extends any[]>
    (this: T, ...args: A): FunctionComponentElement<ProviderProps<T>> {

    const control = 
      useController(this as any, args);

    return control.Provider;
  }

  static useOnce(){
    let state = this.use() as any;
    if(SUBSCRIBE in state)
      state = state.once();
    return state;
  }

  static useOn(...args: any){
    let state = this.use() as any;
    if(SUBSCRIBE in state)
      state = state.on(...args);
    return state;
  }

  static useOnly(...args: any){
    let state = this.use() as any;
    if(SUBSCRIBE in state)
      state = state.only(...args);
    return state;
  }

  static useExcept(...args: any){
    let state = this.use() as any;
    if(SUBSCRIBE in state)
      state = state.not(...args);
    return state;
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
}