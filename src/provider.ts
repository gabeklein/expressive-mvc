import { createContext, createElement, FunctionComponent, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { ownContext } from './context';
import { Controller } from './controller';
import { getDispatch } from './dispatch';
import { ensurePeerControllers } from './peers';
import { useModelController } from './subscriber';
import { BunchOf, Callback } from './types';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

export function createWrappedComponent<T extends typeof Controller>(
  this: T,
  fn: FunctionComponent<InstanceType<T>> ){

  const { Provider } = ownContext(this as any);
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const controller = useModelController(this);
    controller.assign(forwardedProps);
    const { values } = getDispatch(controller);

    const useProps: any = { 
      use: controller, ...values 
    }
    
    return createElement(
      Provider, 
      { value: controller }, 
      createElement(fn, useProps)
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
    const onDidUnmount = ensurePeerControllers(mc);
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
  const pro = Object.getPrototypeOf;

  for(const group of [ fromProps, explicit ])
    for(const key in group){
      let Super = group[key];
      while(Super = pro(Super))
        if(Super === Controller as any)
          map[key] = new group[key]();
    }

  for(let layer = map; layer; layer = pro(layer))
    for(const source in layer)
      for(const target in map)
        if(source !== target)
          (map[target] as any)[source] = layer[source];

  return map;
}