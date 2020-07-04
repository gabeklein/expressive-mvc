import { Context, useContext } from 'react';

import { Controller } from './controller';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { define } from './util';
import { PeerController } from './global';

export const RENEW_CONSUMERS = Symbol("maintain_hooks");

export function ensureAttachedControllers(instance: Controller){
  if(RENEW_CONSUMERS in instance){
    const hookMaintainance = instance[RENEW_CONSUMERS];
    
    if(hookMaintainance)
      hookMaintainance();

    return;
  }

  const pending = [];

  const entries = Object.getOwnPropertyDescriptors(instance);

  for(const key in entries){
    const { value } = entries[key];
    if(value instanceof PeerController)
      pending.push([key, value.context] as const)
  }

  const disableMaintaince = () => {
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

    return disableMaintaince;
  }
  else
    disableMaintaince();
  
  return;
}