import { Context, useContext } from 'react';

import { Controller } from './controller';
import { CONTEXT_MULTIPROVIDER } from './provider';
import { define, entriesIn } from './util';

export const TEMP_CONTEXT = Symbol("temp_maintain_hooks");

type PeerContext = [string, Context<Controller>];

export function ensurePeerControllers(instance: Controller){
  if(TEMP_CONTEXT in instance){
    if(typeof instance[TEMP_CONTEXT] == "function")
      instance[TEMP_CONTEXT]();
    return;
  }

  const pending = [] as PeerContext[];
  const entries = entriesIn(instance);

  for(const [key, { value }] of entries)
    if(Controller.isTypeof(value))
      pending.push([key, value.context!])

  if(pending.length)
    return attachPeersFromContext(instance, pending);
  else 
    instance[TEMP_CONTEXT] = undefined as any;
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

  subject[TEMP_CONTEXT] = () => {
    expected.forEach(useContext);
  }

  return function reset(){
    subject[TEMP_CONTEXT] = undefined as any;
  }
}