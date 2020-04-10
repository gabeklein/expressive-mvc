import { Context, MutableRefObject, useContext, useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { createSubscription, useSubscriber } from './subscriber';
import { Class, ModelController, RENEW_CONSUMERS, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';
import { define } from './util';

const {
  defineProperty,
  getOwnPropertyDescriptor: describe,
  getPrototypeOf: prototypeOf,
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
    willExist: control.componentWillExist || control.willExist,
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
  let endLifecycle: undefined | (() => void)

  const p: ModelController = model.prototype || {};

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount,
    willExist
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

    Dispatch.applyTo(instance);
    cache.current = bindMethods(instance, model.prototype);
    
    if(instance instanceof Controller)
      ensureAttachedControllers(instance as ModelController)
    else if(instance.didInit)
      instance.didInit();

    if(willMount)
      willMount.apply(instance, args);

    if(willRender)
      willRender.apply(instance, args);

    instance = createSubscription(instance, setUpdate);
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
    const state = prototypeOf(instance);
    
    spyControl[SUBSCRIBE]();

    if(willExist)
      endLifecycle = willExist.apply(state, args);

    if(didMount)
      didMount.apply(state, args);

    return () => {
      if(endLifecycle)
        endLifecycle()

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

export function initializeController(instance: ModelController){
  ensureAttachedControllers(instance);

  if(instance.isReady)
    instance.isReady();
}
function ensureAttachedControllers(instance: ModelController){
  if(RENEW_CONSUMERS in instance)
    return;

  const pending = Object.entries(instance).filter(([ k, v ]) =>
    v && typeof v == "object" && "Consumer" in v && "Provider" in v
  )

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

    define(instance, RENEW_CONSUMERS, 
      () => required.forEach(useContext)
    )
  }
  else 
    //TODO: Why does this need to be configurable?
    defineProperty(instance, RENEW_CONSUMERS, { value: undefined, configurable: true })
}

function bindMethods(
  instance: any, 
  prototype: any){

  const boundLayer = Object.create(instance);
  const chain = [];

  while(prototype !== Object.prototype 
     && prototype !== Controller.prototype){
    chain.push(prototype);
    prototype = prototypeOf(prototype);
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
    defineProperty(boundLayer, key, {
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