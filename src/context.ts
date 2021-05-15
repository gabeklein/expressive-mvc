import { createContext, createElement, PropsWithChildren, ReactNode, useContext, useEffect, useMemo } from 'react';

import { Controller, Model } from './controller';
import { create, define, values } from './util';

export class Context {
  private table = new Map<Model, symbol>();

  private key(T: Model){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: Model): Controller | undefined {
    return (this as any)[this.key(T)];
  }
  
  public push(...items: Controller[]){
    const next = create(this) as Context;

    for(const I of items){
      let T = I.constructor as Model;
  
      do {
        define(next, this.key(T), I);
      }
      while(T = T.inherits!);
    }

    return next;
  }

  public pop(){
    for(const c of values<Controller>(this as any))
      c.destroy();
  }

  public provider(children: ReactNode){
    return createElement(Context.Single.Provider, { value: this }, children);
  }

  static Single = createContext(new Context());

  static useLayer(){
    return useContext(this.Single);
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
    return createElement(MultiProvider, { types: target }, children);
  else
    throw new Error("Provider expects either 'of' or 'for' props.");
}

function ParentProvider(
  props: PropsWithChildren<{ target: Model, data: {} }>){

  const instance = props.target.using(props.data);

  const parent = Context.useLayer();
  const layer = useMemo(() => parent.push(instance.get), [props.target]);

  return layer.provider(props.children); 
}

function DirectProvider(
  props: PropsWithChildren<{ target: Controller, data: {} }>){

  props.target.update(props.data);

  const parent = Context.useLayer();
  const layer = useMemo(() => parent.push(props.target), [props.target]);

  return layer.provider(props.children); 
}

function MultiProvider(
  props: PropsWithChildren<{ types: Array<Model> | BunchOf<Model> }>){

  const parent = Context.useLayer();
  const layer = useMemo(() =>  parent.push(
    ...values(props.types).map(T => T.create())
  ), []);

  useEffect(() => () => layer.pop(), []);

  return layer.provider(props.children); 
}