import {
  useEffect,
  useRef,
  MutableRefObject,
} from 'react';

import { Controller } from './controller';
import { applyDispatch } from './subscription';
import { Lifecycle } from './types.d';
import { useSubscriber } from './subscriber';

const {
  create,
  defineProperty: define,
  getOwnPropertyDescriptor: describe,
  getOwnPropertyNames: keysIn,
  getPrototypeOf: proto
} = Object;

const RESERVED = [ 
  "add",
  "constructor", 
  "didMount", 
  "didHook",
  "export",
  "not",
  "on",
  "only",
  "once",
  "Provider",
  "refresh",
  "set",
  "willUnmount", 
  "willHook"
];

export function useModelController(init: any, ...args: any[]){
  const control = useController(init, args, Object.prototype);
  return useSubscriber(control);
}

export function useController<T extends Controller>( 
  control: T,
  args: any[] = [],
  superType: any = Controller.prototype){

  type I = InstanceType<T>;

  const cache = useRef(null) as MutableRefObject<I>
  let instance = cache.current as InstanceType<T>;

  if(instance === null){
    if(control.prototype)
      instance = new control(...args);
    else if(typeof instance == "function")
      instance = (control as any)(...args)
    else 
      instance = control as any;

    if(instance.didHook)
      instance.didHook.apply(instance)
    applyDispatch(instance);
    instance = bindMethods(instance, control.prototype, superType);
    cache.current = instance;
  }
  else if(instance.didHook)
    instance.didHook.apply({})

  if(instance.willHook){
    instance.hold = true;
    instance.willHook();
    instance.hold = false;
  }

  useEffect(() => {
    const state = proto(instance as any);
    const methods: Lifecycle = control.prototype || {}
    return invokeLifecycle(
      state, 
      state.didMount || methods.didMount, 
      state.willUnmount || methods.willUnmount
    );
  }, [])

  return instance;
}

function bindMethods(
  instance: any, 
  prototype: any, 
  stopAt: any = Object.prototype){

  const boundLayer = create(instance);
  const chain = [];

  while(prototype !== stopAt){
    chain.push(prototype);
    prototype = proto(prototype);
  }

  prototype = {};
  for(const methods of chain){
    for(const key of keysIn(methods)){
      if(RESERVED.indexOf(key) >= 0)
        continue;
      const { value } = describe(methods, key)!;
      if(typeof value === "function")
        prototype[key] = value
    }
  } 

  for(const key in prototype)
    define(boundLayer, key, {
      value: prototype[key].bind(instance),
      writable: true
    })

  for(const key of ["get", "set"])
    define(boundLayer, key, {
      value: instance,
      writable: true
    })

  return boundLayer
}

export function invokeLifecycle(
  target: any,
  didMount?: () => void, 
  willUnmount?: () => void){

  if(didMount)
    didMount.call(target);
  return () => {
    if(willUnmount)
      willUnmount.call(target);
    for(const key in target)
      try { delete target[key] }
      catch(err) {}
  }
}