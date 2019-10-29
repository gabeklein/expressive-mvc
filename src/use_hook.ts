import { MutableRefObject, useEffect, useRef } from 'react';

import { Controller, ModelController } from './controller';
import { useSubscription } from './subscriber';
import { ensureDispatch, NEW_SUB } from './subscription';
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
  "componentDidMount", 
  "componentDidHook",
  "export",
  "not",
  "on",
  "only",
  "once",
  "Provider",
  "refresh",
  "set",
  "componentWillUnmount", 
  "componentWillHook"
];

export function useModelController(init: any, ...args: any[]){
  const control = init instanceof Controller
    ? init as ModelController
    : useNewController(init, args, Object.prototype);
  return useSubscription(control);
}

export function useNewController( 
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
        get: ensureDispatch,
        configurable: true
      })
    }

    if(instance.componentWillRender)
      instance.componentWillRender(true)
      
    instance = bindMethods(instance, model.prototype, superType);

    cache.current = instance;
  }
  else if(instance.componentWillRender)
    instance.componentWillRender()

  useEffect(() => {
    const state = proto(instance);
    const methods: Lifecycle = model.prototype || {};

    const componentDidMount = state.componentDidMount || methods.componentDidMount;
    const componentWillUnmount = state.componentWillUnmount || methods.componentWillUnmount;

    if(componentDidMount)
      componentDidMount.call(state);
    return () => {
      if(componentWillUnmount)
        componentWillUnmount.call(state);
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