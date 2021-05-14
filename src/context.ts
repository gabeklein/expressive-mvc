import { createContext, createElement, PropsWithChildren, ReactNode, useContext, useEffect, useMemo } from 'react';

import { Controller, Model } from './controller';
import { create, define, entriesIn, values } from './util';

import Oops from './issues';

class Context {
  private key(T: Model){
    let key = LOOKUP.get(T);
    if(!key)
      LOOKUP.set(T, key = Symbol(T.name));
    return key;
  }

  public find(T: Model): Controller | undefined {
    return (this as any)[this.key(T)];
  }
  
  private register(I: Controller){
    let T = I.constructor as Model;

    do {
      define(this, this.key(T), I);
    }
    while(T = T.inherits!);
  }

  public concat(
    from: Controller | Array<Model> | BunchOf<Model>){

    const layer = create(this) as Context;

    if(from instanceof Controller)
      layer.register(from);
    else {
      if(!Array.isArray(from))
        from = values(from);
  
      for(const T of from)
        layer.register(T.create());
    }

    return layer;
  }

  public destroy(){
    const registered: Controller[] = values(this);
    registered.forEach((c) => c.destroy());
  }
}

const LOOKUP = new Map<Model, symbol>();
const NEEDS_HOOK = new WeakMap<Controller, boolean>();
const CONTEXT_CHAIN = createContext(new Context());

export function getFromContext(Type: Model){
  const instance = useContext(CONTEXT_CHAIN).find(Type);

  if(!instance)
    throw Oops.NothingInContext(Type.name);

  return instance;
}

export function attachFromContext(instance: Controller){
  if(NEEDS_HOOK.has(instance)){
    if(NEEDS_HOOK.get(instance))
      useContext(CONTEXT_CHAIN);
    return;
  }

  const pending = entriesIn(instance)
    .map(([key, desc]) => [key, desc.value])
    .filter(entry => Controller.isTypeof(entry[1]));

  if(!pending.length){
    NEEDS_HOOK.set(instance, false);
    return;
  }

  const context = useContext(CONTEXT_CHAIN);

  for(const [key, type] of pending)
    define(instance, key, context.find(type));

  NEEDS_HOOK.set(instance, true);

  return function reset(){
    NEEDS_HOOK.set(instance, false);
  }
}

function useSpecialContext(
  using: Controller | Array<Model> | BunchOf<Model>){

  const parent = useContext(CONTEXT_CHAIN);
  return useMemo(() => parent.concat(using), [using]);
}

interface ProviderProps {
  of: Controller | Model | Array<Model> | BunchOf<Model>,
  children?: ReactNode 
}

export function Provider(props: ProviderProps){
  const { of: target, children, ...data } = props;
 
  if(Controller.isTypeof(target))
    return createElement(SmartProvider, { target, data }, children);
  else if(target instanceof Controller)
    return createElement(DirectProvider, { target, data }, children);
  else if(typeof target == "object")
    return createElement(MultiProvider, { target }, children);
  else
    throw new Error("Provider expects either 'of' or 'for' props.");
}

function MultiProvider(
  props: PropsWithChildren<{ target: Array<Model> | BunchOf<Model> }>){

  const value = useSpecialContext(props.target);

  useEffect(() => () => value.destroy(), []);

  return createElement(CONTEXT_CHAIN.Provider, { value }, props.children);
}

function SmartProvider(
  props: { target: Model, data: {}, children?: ReactNode }){

  const { target } = props;
  const instance = useMemo(() => target.create(), [target]);
  const value = useSpecialContext(instance);

  instance.update(props.data);
  useEffect(() => () => instance.destroy(), [target]);

  return createElement(CONTEXT_CHAIN.Provider, { value }, props.children);
}

function DirectProvider(
  props: { target: Controller, data: {}, children?: ReactNode }){

  const value = useSpecialContext(props.target);

  props.target.update(props.data);

  return createElement(CONTEXT_CHAIN.Provider, { value }, props.children);
}