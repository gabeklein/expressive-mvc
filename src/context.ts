import { createContext, createElement, ReactNode, useContext, useEffect, useMemo } from 'react';

import { Controller, Model } from './controller';
import { create, define, entriesIn, values } from './util';

import Oops from './issues';

export class Context {
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

  public provider(children: ReactNode){
    return createElement(CONTEXT_CHAIN.Provider, { value: this }, children);
  }

  static find(Type: Model){
    const instance = useContext(CONTEXT_CHAIN).find(Type);
  
    if(!instance)
      throw Oops.NothingInContext(Type.name);
  
    return instance;
  }

  static insert(layer: Controller | Array<Model> | BunchOf<Model>){
    const parent = useContext(CONTEXT_CHAIN);
    return useMemo(() => parent.concat(layer), [layer]);
  }
}

const LOOKUP = new Map<Model, symbol>();
const NEEDS_HOOK = new WeakMap<Controller, boolean>();
const CONTEXT_CHAIN = createContext(new Context());

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

interface ProviderProps {
  of: Controller | Model | Array<Model> | BunchOf<Model>,
  children?: ReactNode 
}

export function Provider(props: ProviderProps){
  const { of: target, children, ...data } = props;
 
  if(Controller.isTypeof(target))
    return createElement(ParentProvider, { target, data }, children);
  else if(target instanceof Controller)
    return createElement(DirectProvider, { target, data }, children);
  else if(typeof target == "object")
    return createElement(MultiProvider, { target }, children);
  else
    throw new Error("Provider expects either 'of' or 'for' props.");
}

function MultiProvider(
  props: { target: Array<Model> | BunchOf<Model>, children?: ReactNode }){

  const layer = Context.insert(props.target);

  useEffect(() => () => layer.destroy(), []);

  return layer.provider(props.children); 
}

function ParentProvider(
  props: { target: Model, data: {}, children?: ReactNode }){

  const instance = props.target.using(props.data);
  const layer = Context.insert(instance.get);

  return layer.provider(props.children); 
}

function DirectProvider(
  props: { target: Controller, data: {}, children?: ReactNode }){

  const layer = Context.insert(props.target);

  props.target.update(props.data);

  return layer.provider(props.children); 
}