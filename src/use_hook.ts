import { Context, MutableRefObject, useContext, useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { ensureDispatch, NEW_SUB } from './dispatch';
import { defineInitializer } from './polyfill';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { SUBSCRIBE, UNSUBSCRIBE, useSubscriber } from './subscriber';
import { Class, ModelController, SpyController } from './types';

export const RENEW_CONSUMERS = "__renew_consumers__";

const {
  defineProperty: define,
  getOwnPropertyDescriptor: describe,
  getPrototypeOf: proto,
  keys: keysIn
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
  "Value",
  "refresh",
  "set",
  "componentWillUnmount", 
  "componentWillHook"
];

export function useModelController(init: any, ...args: any[]){
  return init instanceof Controller
    ? useSubscriber(init as ModelController, args, true)
    : useOwnController(init, args);
}

export function componentLifecycle(control: ModelController){
  return {
    willRender: control.componentWillRender || control.willRender,
    willUpdate: control.componentWillUpdate || control.willUpdate,
    willUnmount: control.componentWillUnmount || control.willUnmount,
    willMount: control.componentWillMount || control.willMount,
    didMount: control.componentDidMount || control.didMount
  }
}

export function useOwnController( 
  model: Class | Function,
  args: any[] = []
): ModelController {

  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;
  let instance = cache.current;

  const p: ModelController = model.prototype || {};

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount
  } = componentLifecycle(p);

  if(instance === null){
    if(model.prototype){
      instance = new (model as Class)(...args);
      if(!model.prototype.cache)
        model.prototype.cache = {}
    }
    else if(typeof instance == "function")
      instance = (model as Function)(...args)
    else 
      instance = model;

    if(instance instanceof Controller)
      resolveAttachedControllers(instance as ModelController)
    else {
      defineInitializer(instance, NEW_SUB, ensureDispatch);
      
      if(instance.didInit)
        instance.didInit();
    }

    if(willMount)
      willMount.apply(instance, args);

    if(willRender)
      willRender.apply(instance, args);

    cache.current = bindMethods(instance, model.prototype);
    instance = instance[NEW_SUB](setUpdate);;
  }
  else {
    if(instance[RENEW_CONSUMERS])
      instance[RENEW_CONSUMERS]()

    if(willUpdate)
      willUpdate.apply(instance, args);

    if(willRender)
      willRender.apply(instance, args);
  }

  useEffect(() => {
    const spyControl = instance as unknown as SpyController;
    const state = proto(instance);
    
    spyControl[SUBSCRIBE]();

    if(didMount)
      didMount.apply(state, args);

    return () => {
      if(willUnmount)
        willUnmount.apply(state, args);

      if("willDestroy" in instance)
        instance.willDestroy();

      spyControl[UNSUBSCRIBE]();
      nuke(state);
    }
  }, [])

  return instance;
}

export function resolveAttachedControllers(instance: ModelController){
  if(RENEW_CONSUMERS in instance)
    return;

  const pending = Object.entries(instance).filter(([ k, v ]) => {
    return typeof v == "object" && "Consumer" in v && "Provider" in v
  })

  if(pending.length){
    let multi = useContext(CONTEXT_MULTIPROVIDER);
    const required = [ CONTEXT_MULTIPROVIDER ] as Context<any>[];

    for(const [name, context] of pending)
      if(multi && multi[name])
        define(instance, name, multi[name])
      else {
        required.push(context)
        define(instance, name, useContext(context))
      }

    define(instance, RENEW_CONSUMERS, { 
      value: () => required.forEach(useContext)
    })
  }
  else 
    define(instance, RENEW_CONSUMERS, { value: undefined })
}

function bindMethods(
  instance: any, 
  prototype: any){

  const boundLayer = Object.create(instance);
  const chain = [];

  while(prototype !== Object.prototype 
     && prototype !== Controller.prototype){
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