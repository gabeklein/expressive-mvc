import {
  Context,
  createContext,
  createElement,
  FunctionComponentElement,
  MutableRefObject,
  PropsWithChildren,
  ProviderProps,
  useEffect,
  useRef,
  useState,
} from 'react';

import { invokeLifecycle } from './helper';
import { Dispatch, SpyController, useContextSubscriber, NEW_SUB } from './subscriber';
import { ExpectsParams, Lifecycle, UpdateTrigger } from './types.d';

const Contexts = new Map<typeof Controller, Context<Controller>>();

export interface Controller {
  /* Force compatibility with <InstanceType> */
  new (...args: any): any;
  [NEW_SUB]: (hook: UpdateTrigger) => SpyController;
}

export class Controller {
  static use<T extends ExpectsParams<A>, A extends any[]>
    (this: T, ...args: A){

    type I = InstanceType<T>;

    const update = useState(0);
    const ref = useRef(null) as MutableRefObject<I>
    let state = ref.current;

    if(state === null){
      const instance = new this(...args);
      void update;
      
      Dispatch.apply(instance);
      state = ref.current = instance as I;
    }

    useEffect(() => {
      let { willUnmount, didMount } = this.prototype as Lifecycle;
      const { willUnmount: will, didMount: did } = state;
      if(will) willUnmount = will;
      if(did) didMount = did;
      return invokeLifecycle(state, didMount, willUnmount);
    }, [])

    return state;
  }

  static specificContext<T extends Controller>(this: T){
    const { prototype } = this;
    let Context = Contexts.get(prototype)!;

    if(!Context){
      Context = createContext(prototype);
      Contexts.set(prototype, Context);
    }

    return Context;
  }

  static hook<T extends Controller>(this: T){
    const Context = (this as any).specificContext();

    return () => 
      useContextSubscriber(Context) as InstanceType<T>;
  }

  private getSpecificContext(){
    const prototype = Object.getPrototypeOf(this);
    let Context = Contexts.get(prototype as any) as any;

    if(!Context){
      const { name } = this.constructor;
      throw new Error(
        `\nNo accessor for class ${name} has been declared in your app; ` +  
        `this is required before using a corresponding Provider! ` + 
        `Run \`${name}.hook()\` and/or \`${name}.specificContext()\` within a module first.\n`
      );
    }

    return Context as Context<Controller>;
  }

  get Provider(): FunctionComponentElement<ProviderProps<this>> {
    const { Provider } = this.getSpecificContext();
    return <any> (
      (props: PropsWithChildren<any>) => 
      createElement(
        Provider,
        { value: this },
        props.children
      )
    )
  }

  didMount?(): void;
  willUnmount?(): void;
}