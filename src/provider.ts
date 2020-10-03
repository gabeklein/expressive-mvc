import { Context, createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { Controller } from './controller';
import { ensurePeerControllers } from './peers';
import { create, getPrototypeOf, Issues, keys, values, within } from './util';

const Oops = Issues({
  ContextNotFound: (name) =>
    `Can't subscribe to controller; this accessor can` +
    `only be used within a Provider keyed to ${name}.`
});

export const CONTEXT = new Map<typeof Controller, Context<Controller>>()
export const CONTEXT_MULTIPLEX = createContext(null as any);

export function getContext(
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
    || useContext(CONTEXT_MULTIPLEX)[Type.name];

  if(!instance)
    throw Oops.ContextNotFound(Type.name);

  return instance;
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

export const MultiProvider = (props: PropsWithChildren<any>) => {
  let {
    children,
    className,
    style,
    of: controllers = {},
    ...outsideProps
  } = props;

  if(className || style)
    children = createElement("div", { className, style, children });

  let flushHooks = [] as Callback[];

  const parent = useContext(CONTEXT_MULTIPLEX);
  const provide = useMemo(() =>
    initGroupControllers(parent, controllers, outsideProps),
  []); 

  values(provide).forEach(mc => {
    const onDidUnmount = ensurePeerControllers(mc);
    if(onDidUnmount)
      flushHooks.push(onDidUnmount);
  })

  useEffect(() => () => {
    flushHooks.forEach(x => x());
    values(provide).forEach(x => x.destroy());
  }, []);

  return createElement(CONTEXT_MULTIPLEX.Provider, { value: provide, children });
}

function initGroupControllers(
  parent: any,
  explicit: BunchOf<typeof Controller>,
  fromProps: BunchOf<typeof Controller> 
){
  const map = create(parent) as BunchOf<Controller>;

  for(const group of [ fromProps, explicit ])
    for(const key in group){
      let Super = group[key];
      while(Super = getPrototypeOf(Super))
        if(Super === Controller as any)
          map[key] = new group[key]();
    }

  for(let layer = map; layer; layer = getPrototypeOf(layer))
    for(const source in layer)
      for(const target in map)
        if(source !== target)
          within(map[target], source, layer[source]);

  return map;
}