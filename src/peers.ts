import { Context, useContext } from 'react';

import { contextGetterFor, ownContext } from './context';
import { Controller, Singleton } from './controller';
import { globalController } from './global';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';
import { define, defineOnAccess } from './util';

export const RENEW_CONSUMERS = Symbol("maintain_hooks");

export class PeerController {
  constructor(
    private type: typeof Controller
  ){}

  get context(){
    return ownContext(this.type);
  }

  attachNowIfGlobal(parent: Controller, key: string){
    const { type } = this;

    if(type.global){
      defineOnAccess(parent, key, () => globalController(type))
      return
    }
      
    if(parent instanceof Singleton)
      throw new Error(
        `Global controller '${parent.constructor.name}' attempted to attach '${type.name}'. ` +
        `This is not possible because '${type.name}' is not also global. ` + 
        `Did you forget to extend 'Singleton'?`
      )
  }
}

export function getPeerController(
  from: Controller | typeof Controller,
  ...args: any[]){

  if(from instanceof Controller)
    return useSubscriber(from, args, false)
  else
    return new PeerController(from)
}

export function ensurePeerControllers(instance: Controller){
  if(RENEW_CONSUMERS in instance){
    const hookMaintainance = instance[RENEW_CONSUMERS];
    
    if(hookMaintainance)
      hookMaintainance();

    return;
  }

  const pending = [];
  const properties = Object.getOwnPropertyDescriptors(instance);

  for(const [key, { value }] of Object.entries(properties))
    if(value instanceof PeerController)
      pending.push([key, value.context] as const)

  const stopMaintaince = () => {
    Object.defineProperty(instance, RENEW_CONSUMERS, { value: undefined });
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

    Object.defineProperty(instance, RENEW_CONSUMERS, { 
      value: () => required.forEach(useContext), 
      configurable: true 
    });

    return stopMaintaince;
  }
  else
    stopMaintaince();
  
  return;
}