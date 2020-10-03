import { Context, useContext } from 'react';

import { Controller } from './controller';
import { getContext, CONTEXT_MULTIPLEX } from './provider';
import { define, entriesIn } from './util';

const MAINTAIN = new WeakMap<Controller, Function | undefined>();

export function ensurePeerControllers(instance: Controller){
  if(MAINTAIN.has(instance)){
    const hook = MAINTAIN.get(instance);
    hook && hook();
    return;
  }

  const pending = [] as [string, Context<Controller>][];
  const entries = entriesIn(instance);

  for(const [key, { value }] of entries)
    if(Controller.isTypeof(value))
      pending.push([key, getContext(value)])

  if(!pending.length){
    MAINTAIN.set(instance, undefined);
    return;
  }

  const multi = useContext(CONTEXT_MULTIPLEX) || {};
  const expected = [ CONTEXT_MULTIPLEX ];

  for(const [name, context] of pending)
    define(instance, name, multi[name] || (
      expected.push(context), useContext(context)
    ))

  MAINTAIN.set(instance, () => expected.forEach(useContext));

  return function reset(){
    MAINTAIN.set(instance, undefined);
  }
}