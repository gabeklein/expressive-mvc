import { Context, MutableRefObject, useContext, useEffect, useRef, useState } from 'react';

import { Controller, NEW_SUB, SUBSCRIBE, UNSUBSCRIBE } from './controller';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';
import { ensureDispatch } from './dispatch';
import { BunchOf, Class, ModelController, SpyController } from './types';

const RENEW_CONSUMERS = "__renew_consumers__";

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
  "refresh",
  "set",
  "componentWillUnmount", 
  "componentWillHook"
];

export function useModelController(init: any, ...args: any[]){
  return init instanceof Controller
    ? useSubscriber(init as ModelController, args)
    : useOwnController(init, args, Object.prototype);
}

export function useOwnController( 
  model: Class | Function,
  args: any[] = [],
  superType: any = Controller.prototype
): ModelController {

  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;
  let instance = cache.current;

  const { prototype: p = {} } = model;

  const willRender = p.componentWillRender || p.willRender;
  const willUpdate = p.componentWillUpdate || p.willUpdate;
  const willUnmount = p.componentWillUnmount || p.willUnmount;
  const didMount = p.componentDidMount || p.didMount;
  const willMount = p.componentWillMount || p.willMount;

  if(instance === null){
    if(model.prototype)
      instance = new (model as Class)(...args);
    else if(typeof instance == "function")
      instance = (model as Function)(...args)
    else 
      instance = model;

    if(instance instanceof Controller)
      applyAutomaticContext(instance)
    else {
      define(instance, NEW_SUB, {
        get: ensureDispatch,
        configurable: true
      })
    
      if(instance.didInit)
        instance.didInit();
    }

    if(willMount)
      willMount.call(instance);

    if(willRender)
      willRender.call(instance);

    cache.current = bindMethods(instance, model.prototype, superType);
  instance = instance[NEW_SUB](setUpdate);
  }
  else {
    if(RENEW_CONSUMERS in instance)
      instance[RENEW_CONSUMERS]()

    if(willUpdate)
      willUpdate.call(instance);

    if(willRender)
      willRender.call(instance);
  }

  useEffect(() => {
    const spyControl = instance as unknown as SpyController;
    const state = proto(instance);
    
    spyControl[SUBSCRIBE]();

    if(didMount)
      didMount.call(state);

    return () => {
      if(willUnmount)
        willUnmount.call(state);

      if("willDestroy" in instance)
        instance.willDestroy();

      spyControl[UNSUBSCRIBE]();
      nuke(state);
    }
  }, [])

  return instance;
}

function applyAutomaticContext(instance: any){
  const consumable = {} as BunchOf<Context<any>>;

  for(const property in instance){
    const context: any = instance[property]
    if(typeof context == "object"
    && "Consumer" in context 
    && "Provider" in context)
      consumable[property] = context;
  }

  if(keysIn(consumable).length == 0)
    return;

  let multi = useContext(CONTEXT_MULTIPROVIDER);
  const required = [ multi ] as Context<any>[];

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