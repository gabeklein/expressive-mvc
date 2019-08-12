import {
  createContext,
  createElement,
  FunctionComponentElement,
  MutableRefObject,
  PropsWithChildren,
  ProviderProps,
  useEffect,
  useRef,
  useState,
  Context,
  useContext,
} from 'react';

import { invokeLifecycle } from './helper';
import { Lifecycle } from './types.d';
import { applyLiveState, bootstrapForIn } from './bootstrap';

const Contexts = new Map<typeof Controller, Context<Controller>>();

type Class = new (...args: any) => any;

interface ExpectsParams<A extends any[]> {
  new(...args: A): any
}

export class Controller {
  static use <T extends ExpectsParams<A>, A extends any[]>(this: T, ...args: A){

    type I = InstanceType<T>;

    const update = useState(0);
    const ref = useRef(null) as MutableRefObject<I>

    if(ref.current === null){
      const instance = new this(...args);
      applyLiveState(instance, update[1]);
      bootstrapForIn(instance, this.prototype, Controller.prototype);
      ref.current = instance as I;
    }

    useEffect(() => {
      let { willUnmount, didMount } = this.prototype as Lifecycle;
      const { willUnmount: will, didMount: did } = ref.current;
      if(will) willUnmount = will;
      if(did) didMount = did;
      return invokeLifecycle(ref.current, didMount, willUnmount);
    }, [])

    return ref.current;
  }

  static specificContext<T extends Class>(this: T){
    const { prototype } = this;
    let Context = Contexts.get(prototype);

    if(!Context){
      Context = createContext(prototype);
      Contexts.set(prototype, Context);
    }

    return Context;
  }

  static hook<T extends Class>(this: T){
    const Context = (this as any).specificContext() as Context<Controller>;

    return function useController(): InstanceType<T> {
      return useContext(Context as any);
    }
  }

  private specificContext(){
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

    return Context as Context<this>;
  }

  get Provider(): FunctionComponentElement<ProviderProps<this>> {
    const { Provider } = this.specificContext();
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