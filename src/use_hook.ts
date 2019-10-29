import { MutableRefObject, useEffect, useRef } from 'react';

import { Controller, ModelController } from './controller';
import { useSubscriber } from './subscriber';
import { firstCreateDispatch, NEW_SUB } from './subscription';
import { Class, Lifecycle } from './types.d';

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

export function useController( 
  model: Class | Function,
  args: any[] = [],
  superType: any = Controller.prototype
): ModelController {

  const cache = useRef(null) as MutableRefObject<any>
  let instance = cache.current;

  if(instance === null){
    if(model.prototype)
      instance = new (model as Class)(...args);
    else {
      if(typeof instance == "function")
        instance = (model as Function)(...args)
      else 
        instance = model;

      define(instance, NEW_SUB, {
        get: firstCreateDispatch,
        configurable: true
      })
    }

    if(instance.didHook)
      instance.didHook()
      
    instance = bindMethods(instance, model.prototype, superType);

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
    const state = proto(instance);
    const methods: Lifecycle = model.prototype || {};

    const didMount = state.didMount || methods.didMount;
    const willUnmount = state.willUnmount || methods.willUnmount;

    if(didMount)
      didMount.call(state);
    return () => {
      if(willUnmount)
        willUnmount.call(state);
      nuke(state);
    }
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

  return boundLayer
}

function nuke(target: any){
    for(const key in target)
      try { delete target[key] }
      catch(err) {}
  }