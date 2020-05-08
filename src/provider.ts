import { createContext, createElement, FunctionComponent, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { ensureAttachedControllers } from './bootstrap';
import { ownContext } from './context';
import { Controller } from './controller';
import { DISPATCH } from './dispatch';
import { useOwnController } from './subscriber';
import { BunchOf, Callback } from './types';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

const { getPrototypeOf: proto } = Object;

export function createWrappedComponent<T extends typeof Controller>(
  this: T,
  fn: FunctionComponent<InstanceType<T>> ){

  const { Provider } = ownContext(this as any);
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const controller = useOwnController(this).assign(forwardedProps);
    const unwrapped = Object.assign({}, controller[DISPATCH]!.current);

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

  props = Object.assign({}, props);
  
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

  Object.values(provide).forEach(mc => {
    const onDidUnmount = ensureAttachedControllers(mc);
    if(onDidUnmount)
      flushHooks.push(onDidUnmount);
  })

  useEffect(() => {
    return () => {
      flushHooks.forEach(x => x());
      Object.values(provide).forEach(x => {
        if(x.willDestroy)
          x.willDestroy();
      });
    }
  }, []);

  return createElement(Multi.Provider, { value: provide }, children);
}

function initGroupControllers(
  parent: any,
  explicit: BunchOf<typeof Controller>,
  fromProps: BunchOf<typeof Controller> 
){
  const map = Object.create(parent) as BunchOf<Controller>;

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