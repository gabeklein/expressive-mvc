import { Context, createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import type { Controller } from './controller';
import { create, define, entriesIn, getPrototypeOf, Issues, keys, values } from './util';

const Oops = Issues({
  ContextNotFound: (name) =>
    `Can't subscribe to controller; this accessor can` +
    `only be used within a Provider keyed to ${name}.`
});

const MAINTAIN = new WeakMap<Controller, Function | undefined>();
const CONTEXT = new Map<typeof Controller, Context<Controller>>()
const MASTER_CONTEXT = createContext(null as any);

function getContext(
  Type: typeof Controller,
  create?: boolean){

  let context = CONTEXT.get(Type);
  if(!context && create){
    context = createContext(null as any);
    CONTEXT.set(Type, context);
  }
  return context!;
}

export function getFromContext(
  Type: typeof Controller){

  const context = getContext(Type);
  const instance = context
    && useContext(context)
    || useContext(MASTER_CONTEXT)[Type.name];

  if(!instance)
    throw Oops.ContextNotFound(Type.name);

  return instance;
}

export function attachFromContext(instance: Controller){
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

  const multi = useContext(MASTER_CONTEXT) || {};
  const expected = [ MASTER_CONTEXT ];

  for(const [name, context] of pending)
    define(instance, name, multi[name] || (
      expected.push(context), useContext(context)
    ))

  MAINTAIN.set(instance, () => expected.forEach(useContext));

  return function reset(){
    MAINTAIN.set(instance, undefined);
  }
}

export function ControlProvider(this: Controller){
  const Model = this.constructor as typeof Controller;
  const Context = getContext(Model, true);
  
  return (props: PropsWithChildren<any>) => {
    let { children, className, style, ...outsideProps } = props;

    if(keys(outsideProps).length)
      this.update(outsideProps);

    if(className || style)
      children = createElement("div", { className, style, children });

    return createElement(Context.Provider, { value: this, children });
  }
}

export function MultipleProvider(props: PropsWithChildren<any>){
  let {
    style,
    children,
    className,
    of: group = []
  } = props;

  let flushHooks = [] as Callback[];

  const parent = useContext(MASTER_CONTEXT);
  const provide = useMemo(() => {
    const map = new Map<typeof Controller, Controller>();
    
    create(parent) as BunchOf<Controller>;

    for(const Type of group)
      for(let layer = Type; layer = getPrototypeOf(layer);)
        if(layer === Controller){
          map.set(Type, new Type());
          break;
        }

    return map;
  }, []); 

  values(provide).forEach(mc => {
    const onDidUnmount = attachFromContext(mc);
    if(onDidUnmount)
      flushHooks.push(onDidUnmount);
  })

  useEffect(() => () => {
    flushHooks.forEach(x => x());
    values(provide).forEach(x => x.destroy());
  }, []);

  if(className || style)
    children = createElement("div", { className, style, children });

  return createElement(MASTER_CONTEXT.Provider, { value: provide, children });
}