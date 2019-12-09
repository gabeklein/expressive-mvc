import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo, FunctionComponent } from 'react';

import { Controller } from './controller';
import { BunchOf, ModelController } from './types';
import { useOwnController, applyAutomaticContext, RENEW_CONSUMERS } from './use_hook';
import { ownContext } from './context';
import { SOURCE } from './dispatch';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

const { create, getPrototypeOf: proto, assign } = Object;

export function createWrappedComponent<T extends typeof ModelController>(
  this: T,
  fn: FunctionComponent<InstanceType<T>> ){

  const { Provider } = ownContext(this as any);
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const controller = useOwnController(this).watch(forwardedProps);
    const unwrapped = assign({}, controller[SOURCE]);

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
  let {
    children,
    className,
    style,
    of: controllers = {},
    ...rest
  } = props;

  const Multi = CONTEXT_MULTIPROVIDER;
  let initial: true | undefined;

  if(className || style)
    children = createElement("div", { className, style }, children);

  const parent = useContext(Multi);
  const provide = useMemo(
    () => {
      initial = true;
      return initGroupControllers(parent, controllers, rest)
    }, []
  ); 

  useEffect(() => {
    for(const type in provide)
      provide[type].willDestroy();
  }, []);

  for(const key in provide){
    const mc: any = provide[key];
    if(initial)
      applyAutomaticContext(mc)
    else if(RENEW_CONSUMERS in mc)
      mc[RENEW_CONSUMERS]()
  }

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