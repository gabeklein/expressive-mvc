import { Context, MutableRefObject, useContext, useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { ensureDispatch, NEW_SUB } from './dispatch';
import { defineInitializer } from './polyfill';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { SUBSCRIBE, UNSUBSCRIBE, useSubscriber } from './subscriber';
import { BunchOf, Class, ModelController, SpyController } from './types';

export const RENEW_CONSUMERS = "__renew_consumers__";

const {
  create,
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
    ? useSubscriber(init as ModelController, args)
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
      resolveAttachedControllers(instance)
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
    if(RENEW_CONSUMERS in instance)
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

export function resolveAttachedControllers(instance: any){
  const consumable = {} as BunchOf<Context<any>>;

  for(const property in instance){
    const placeholder: any = instance[property];
    if(!placeholder)
      continue;

    else if(
      typeof placeholder == "object"
      && "Consumer" in placeholder 
      && "Provider" in placeholder)
        consumable[property] = placeholder;
  }

  if(keysIn(consumable).length == 0)
    return;

  let multi = useContext(CONTEXT_MULTIPROVIDER);
  const required = [ CONTEXT_MULTIPROVIDER ] as Context<any>[];

  for(const key in consumable)
    if(multi && multi[key])
      instance[key] = multi[key];
    else {
      required.push(consumable[key])
      instance[key] = useContext(consumable[key])
    }

  define(instance, RENEW_CONSUMERS, { 
    value: () => {
      for(const C of required)
        useContext(C)
    } 
  })
}

function bindMethods(
  instance: any, 
  prototype: any){

  const boundLayer = create(instance);
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