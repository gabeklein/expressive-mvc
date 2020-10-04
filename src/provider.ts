import { createContext, createElement, PropsWithChildren, ReactNode, useContext, useEffect, useMemo } from 'react';

import type { Controller, Model } from './controller';
import { define, entriesIn, Issues } from './util';

const Oops = Issues({
  ContextNotFound: (name) =>
    `Can't subscribe to controller; this accessor can` +
    `only be used within a Provider keyed for ${name}.`
});

const CONTEXT_BASE = createLayer();
const CONTEXT_CHAIN = createContext(CONTEXT_BASE);
const NEEDS_HOOK = new WeakMap<Controller, boolean>();

type Register = readonly (readonly [Model, Controller])[];
type Lookup = {
  find(T: Model): Controller | undefined;
  extend(from?: Controller | (Model)[]): Lookup;
  destroy(): void;
}

function createLayer(
  inherits?: Lookup,
  provides?: Register){
  
  const local = new Map(provides);
  const lookup: Lookup = {
    find(T){
      if(local.has(T))
        return local.get(T);
      else if(inherits)
        return inherits.find(T);
    },
    extend(insert){
      let provides: Register | undefined;

      if(Array.isArray(insert)){
        provides = insert.map(Type => {
          const instance = Type.create();
          return [Type, instance];
        })
      }
      else if(insert){
        const Type = insert.constructor as Model;
        provides = [[Type, insert]];
      }

      return createLayer(lookup, provides);
    },
    destroy(){
      local.forEach(c => c.destroy())
    }
  }

  return lookup;
}

export function getFromContext(Type: Model){
  const instance = useContext(CONTEXT_CHAIN).find(Type);

  if(!instance)
    throw Oops.ContextNotFound(Type.name);

  return instance;
}

export function attachFromContext(instance: Controller){
  if(NEEDS_HOOK.has(instance)){
    if(NEEDS_HOOK.get(instance))
      useContext(CONTEXT_CHAIN);
    return;
  }

  const pending = entriesIn(instance).filter(
    entry => Controller.isTypeof(entry[1].value)
  )

  if(!pending.length){
    NEEDS_HOOK.set(instance, false);
    return;
  }
  
  const context = useContext(CONTEXT_CHAIN);

  for(const [key, { value }] of pending)
    define(instance, key, context.find(value));

  NEEDS_HOOK.set(instance, true);

  return () => NEEDS_HOOK.set(instance, false);
}

export function ControlProvider(this: Controller){
  return ({ children }: PropsWithChildren<{}>) => {
    const parent = useContext(CONTEXT_CHAIN);
    const provide = useMemo(() => parent.extend(this), []);

    return createElement(
      CONTEXT_CHAIN.Provider, { value: provide }, children
    );
  }
}

type InsertProviderProps = {
  of?: (Model)[];
  children: ReactNode;
};

export function InsertProvider({
  of: insertTypes, children
}: InsertProviderProps){
  const parent = useContext(CONTEXT_CHAIN);
  const provide = useMemo(() => parent.extend(insertTypes), []);

  useEffect(() => provide.destroy, []);

  return createElement(
    CONTEXT_CHAIN.Provider, { value: provide }, children
  );
}