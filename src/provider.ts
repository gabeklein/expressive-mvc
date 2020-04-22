import { createContext, createElement, FunctionComponent, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { ownContext } from './context';
import { Controller } from './controller';
import { BunchOf, ModelController, Callback } from './types';
import { useOwnController } from './use_hook';
import { ensureAttachedControllers } from './bootstrap';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

const { assign, create, values: valuesIn, getPrototypeOf: proto } = Object;

export function createWrappedComponent<T extends typeof ModelController>(
  this: T,
  fn: FunctionComponent<InstanceType<T>> ){

  const { Provider } = ownContext(this as any);
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const controller = useOwnController(this).assign(forwardedProps);
    const unwrapped = assign({}, controller.dispatch!.current);

    const useProps: any = {
      ...unwrapped,
      use: controller
    }
    
    return createElement(
      Provider, { value: controller }, createElement(fn, useProps)
    )
  }
}

export const MultiProvider = (props: PropsWithChildren<any>) => {
  let { children, className, style, of: controllers = {} } = props;

  props = assign({}, props);
  
  for(const k of ["children", "className", "style", "of"])
    delete props[k];

  const Multi = CONTEXT_MULTIPROVIDER;

  if(className || style)
    children = createElement("div", { className, style }, children);

  let flushHooks = [] as Callback[];

  const parent = useContext(Multi);
  const provide = useMemo(
    () => initGroupControllers(parent, controllers, props), []
  ); 

  valuesIn(provide).forEach(mc => {
    const onDidUnmount = ensureAttachedControllers(mc);
    if(onDidUnmount)
      flushHooks.push(onDidUnmount);
  })

  useEffect(() => {
    return () => {
      flushHooks.forEach(x => x());
      valuesIn(provide).forEach(x => x.willDestroy());
    }
  }, []);

  return createElement(Multi.Provider, { value: provide }, children);
}

function initGroupControllers(
  parent: any,
  explicit: BunchOf<typeof ModelController>,
  fromProps: BunchOf<typeof ModelController> 
){
  const map = create(parent) as BunchOf<ModelController>;

  for(const group of [ fromProps, explicit ])
    for(const key in group){
      let Super = group[key];
      while(Super = proto(Super))
        if(Super === Controller as any)
          map[key] = new group[key]();
    }

  for(let layer = map; layer; layer = proto(layer))
  for(const source in layer)
  for(const target in map)
  if(source !== target)
    (map[target] as any)[source] = layer[source];

  return map;
}