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
} from 'react';

import { invokeLifecycle } from './helper';
import { Lifecycle } from './types.d';
import { applyLiveState, bootstrapForIn } from './bootstrap';

const ControlContext = createContext<Controller>(null as any);

interface ClassWithParams<A extends any[]> {
  new(...args: A): any
}

export class Controller {
  static use <T extends ClassWithParams<A>, A extends any[]>(this: T, ...args: A){

    type I = InstanceType<T>;

    const update = useState(0);
    const ref = useRef(null) as MutableRefObject<I>

    if(ref.current === null){
      const instance = new this(...args);
      applyLiveState(instance, update[1]);
      bootstrapForIn(instance, this.prototype, Controller.prototype)
      ref.current = instance as I;
    }

    useEffect(() => {
      let { willUnmount, didMount } = this.prototype as Lifecycle;
      return invokeLifecycle(ref.current, didMount, willUnmount);
    }, [])

    return ref.current;
  }

  get Provider(): FunctionComponentElement<ProviderProps<this>> {
    return <any> (
      (props: PropsWithChildren<any>) => 
      createElement(
        ControlContext.Provider,
        { value: this } as any,
        props.children
      )
    )
  }

  didMount?(): void;
  willUnmount?(): void;
}