import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { Controller, Model } from './controller';
import { assignSpecific, create, define, entriesIn, values } from './util';

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
  
  private register(T: Model, I: Controller){
    do {
      define(this, this.key(T), I);
    }
    while(T = T.inherits!);
  }
  public concat(instance: Controller){
    const layer: Context = create(this);
    layer.register(instance.constructor as Model, instance);
    return layer;
  }

  public manage(types: Array<Model> | BunchOf<Model>){
    const layer: Context = create(this);

    if(!Array.isArray(types))
      types = values(types);

    for(const Type of types)
      layer.register(Type, Type.create());
      
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

  return () => NEEDS_HOOK.set(instance, false);
}

type MultiProviderProps = { of: Array<Model> | BunchOf<Model> };
type SingleProviderProps = { of: Model | Controller, data: {} };

export function MultiProvider(
  props: PropsWithChildren<MultiProviderProps>){

  const parent = useContext(CONTEXT_CHAIN);
  const layer = useMemo(() => parent.manage(props.of), []);

  useEffect(() => layer.destroy, []);

  return createElement(
    CONTEXT_CHAIN.Provider, { value: layer }, props.children
  );
}

export function SingleProvider(props: PropsWithChildren<SingleProviderProps>){
  const target = props.of;

  function assign(){
    assignSpecific(instance, props.data);
  }

  const instance = useMemo(() => {
    return typeof target == "function" ? target.create() : target;
  }, [target]);

  assign();

  const parent = useContext(CONTEXT_CHAIN);
  const layer = useMemo(() => parent.concat(instance), [instance]);

  useEffect(() => {
    if(target !== instance)
      return () => instance.destroy();
  }, [target])

  return createElement(CONTEXT_CHAIN.Provider, { value: layer }, props.children);
}

export function Provider(
  props: PropsWithChildren<{ of: Controller } | MultiProviderProps>){

  const { of: target, children, ...rest } = props;
 
  if(typeof target == "function" || target instanceof Controller)
    return createElement(SingleProvider, { of: target, data: rest }, children);
  else if(typeof target == "object")
    return createElement(MultiProvider, { of: target }, children);
  else
    throw new Error("Provider expects either 'of' or 'for' props.");
}