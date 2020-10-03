import { Context, useContext } from 'react';

import { Controller } from './controller';
import { getContext, CONTEXT_MULTIPLEX } from './provider';
import { define, entriesIn } from './util';

type PeerContext = [string, Context<Controller>];

const MAINTAIN = new WeakMap<Controller, Function | undefined>();

export function ensurePeerControllers(instance: Controller){
  if(MAINTAIN.has(instance)){
    const hook = MAINTAIN.get(instance);
    hook && hook();
    return;
  }

  const pending = [] as PeerContext[];
  const entries = entriesIn(instance);

  for(const [key, { value }] of entries)
    if(Controller.isTypeof(value))
      pending.push([key, getContext(value)])

  if(pending.length)
    return attachPeersFromContext(instance, pending);
  else
    MAINTAIN.set(instance, undefined);
}

function attachPeersFromContext(
  subject: Controller, peers: PeerContext[]){

  const multi = useContext(CONTEXT_MULTIPLEX);
  const expected = [ CONTEXT_MULTIPLEX ] as Context<any>[];

  for(const [name, context] of peers)
    if(multi && multi[name])
      define(subject, name, multi[name])
    else {
      expected.push(context)
      define(subject, name, useContext(context))
    }

  MAINTAIN.set(subject, () => {
    expected.forEach(useContext);
  });

  return function reset(){
    MAINTAIN.set(subject, undefined);
  }
}