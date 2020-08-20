import { Context, useContext } from 'react';

import { contextFor } from './context';
import { Controller, Singleton } from './controller';
import { globalController } from './global';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { useSubscriber } from './subscriber';
import { define, defineOnAccess } from './util';

export const RENEW_CONSUMERS = Symbol("maintain_hooks");

type PeerContext = [string, Context<Controller>];

export class PeerController {
  constructor(
    private type: typeof Controller
  ){}

  get context(){
    return contextFor(this.type);
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
    if(typeof instance[RENEW_CONSUMERS] == "function")
      instance[RENEW_CONSUMERS]();
    return;
  }

  const pending = [] as PeerContext[];
  const properties = Object.getOwnPropertyDescriptors(instance);
  const entries = Object.entries(properties);

  for(const [key, { value }] of entries)
    if(value instanceof PeerController)
      pending.push([key, value.type.context!])

  if(pending.length)
    return attachPeersFromContext(instance, pending);
  else 
    instance[RENEW_CONSUMERS] = undefined as any;
}

function attachPeersFromContext(
  subject: Controller,
  peers: PeerContext[]){

  const multi = useContext(CONTEXT_MULTIPROVIDER);
  const expected = [ CONTEXT_MULTIPROVIDER ] as Context<any>[];

  for(const [name, context] of peers)
    if(multi && multi[name])
      define(subject, name, multi[name])
    else {
      expected.push(context)
      define(subject, name, useContext(context))
    }

  subject[RENEW_CONSUMERS] = () => {
    expected.forEach(useContext);
  }

  return function reset(){
    subject[RENEW_CONSUMERS] = undefined as any;
  }
}