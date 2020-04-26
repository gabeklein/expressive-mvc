import { Context, useContext } from 'react';

import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { ModelController, RENEW_CONSUMERS } from './types';
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
  "Provider",
  "Value",
  "refresh",
  "set",
  "componentWillUnmount", 
  "componentWillHook"
];

export function ensureReady(instance: {}){
  if(!("dispatch" in instance))
    Dispatch.applyTo(instance as any);

  if(instance instanceof Controller)
    return ensureAttachedControllers(instance as ModelController);
  else
    return;
}

export function ensureAttachedControllers(instance: ModelController){
  if(RENEW_CONSUMERS in instance){
    const hookMaintainance = instance[RENEW_CONSUMERS];
    
    if(hookMaintainance)
      hookMaintainance();

    return;
  }

  const pending = Object.entries(instance).filter(([ k, v ]) =>
    v && typeof v == "object" && "Consumer" in v && "Provider" in v
  )

  const disableMaintaince = () => {
    defineProperty(instance, RENEW_CONSUMERS, { value: undefined });
  }

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

    defineProperty(instance, RENEW_CONSUMERS, { 
      value: () => required.forEach(useContext), 
      configurable: true 
    });

    return disableMaintaince;
  }
  else
    disableMaintaince();
  
  return;
}

export function bindMethods(
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