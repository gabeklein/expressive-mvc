import { createContext, createElement, PropsWithChildren, ReactNode, useContext, useEffect, useMemo } from 'react';

import type { Controller, Model } from './controller';
import { create, define, getPrototypeOf, values, within } from './util';

import Oops from './issues';

const ADDRESS = new Map<Model, symbol[]>();

export function keysFor(
  T: typeof Controller): symbol[] {

  let symbols = ADDRESS.get(T);

  if(!symbols){
    ADDRESS.set(T,
      symbols = [ Symbol(T.name) ]);

    if(T.inherits)
      symbols.push(...keysFor(T.inherits));
  }

  return symbols;
}

class Context {
  find(T: Model){
    let instance: Controller | undefined;
    const race = new Map<Controller, symbol>();

    for(const key of keysFor(T)){
      const target = within(this, key);
      if(target && !race.has(target))
        race.set(instance = target, key);
    }

    if(race.size > 1){
      let min = Infinity;
      for(const [target, key] of race)
        for(let c = this, i = 0; i<min; c = getPrototypeOf(c), i++)
          if(c.hasOwnProperty(key)){
            instance = target;
            min = i;
            break;
          }
    }

    return instance;
  }

  concat(instance: Controller){
    const layer = create(this);
    const T = instance.constructor as Model;

    for(const key of keysFor(T))
      define(layer, key, instance);

    return layer as Context;
  }

  manage(from: (Model)[] = []){
    const layer = create(this);

    for(const Type of from){
      const instance = Type.create();
      for(const key of keysFor(Type))
        define(layer, key, instance);
    }
      
    return layer as Context;
  }

  destroy(){
    const registered: Controller[] = values(this);
    registered.forEach((c) => c.destroy());
  }
}

const CONTEXT_CHAIN = createContext(new Context());
const NEEDS_HOOK = new WeakMap<Controller, boolean>();

export function getFromContext(Type: Model){
  const instance = useContext(CONTEXT_CHAIN).find(Type);

  if(!instance)
    throw Oops.NothingInContext(Type.name);

  return instance;
}

type GetPeers = (instance: Controller) => [string, typeof Controller][];

export function attachFromContext(
  instance: Controller,
  getPending: GetPeers){

  if(NEEDS_HOOK.has(instance)){
    if(NEEDS_HOOK.get(instance))
      useContext(CONTEXT_CHAIN);
    return;
  }

  const pending = getPending(instance);

  if(!pending.length){
    NEEDS_HOOK.set(instance, false);
    return;
  }
  
  const context = useContext(CONTEXT_CHAIN);

  for(const [key, type] of pending)
    define(instance, key, context.find(type));

  NEEDS_HOOK.set(instance, true);

  return () => NEEDS_HOOK.set(instance, false);
}

export function ControlProvider(this: Controller | Model){
  return ({ children }: PropsWithChildren<{}>) => {
    const parent = useContext(CONTEXT_CHAIN);
    const provide = useMemo(() => parent.concat(
      typeof this == "function" ? this.create() : this
    ), []);

    return createElement(
      CONTEXT_CHAIN.Provider, { value: provide }, children
    );
  }
}

type InsertProviderProps = {
  of?: (Model)[];
  children: ReactNode;
};

export function InsertProvider(props: InsertProviderProps){
  const { of: insertTypes, children } = props;
  const parent = useContext(CONTEXT_CHAIN);
  const provide = useMemo(() => parent.manage(insertTypes), []);

  useEffect(() => provide.destroy, []);

  return createElement(
    CONTEXT_CHAIN.Provider, { value: provide }, children
  );
}