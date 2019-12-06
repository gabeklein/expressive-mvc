import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo, FunctionComponent } from 'react';

import { Controller } from './controller';
import { BunchOf, ModelController } from './types';
import { useOwnController } from './use_hook';
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

export function findInMultiProvider(
  name: string): ModelController {
    
  const multi = useContext(CONTEXT_MULTIPROVIDER) as any;
  if(multi[name])
    return multi[name];
  else
    throw new Error(
      `Can't subscribe to controller;` +
      ` this accessor can only be used within a Provider keyed to \`${name}\``
    )
} 

export const MultiProvider = (props: PropsWithChildren<any>) => {
  let {
    children,
    className,
    style,
    of: controllers = {},
    ...rest
  } = props;

  const Own = CONTEXT_MULTIPROVIDER;

  if(className || style)
    children = createElement("div", { className, style }, children);
    
  function createOnWillMount(){
    return initGroupControllers(parent, controllers, rest)
  }
  
  function destroyOnUnmount(){
    for(const type in provide)
      provide[type].willDestroy();
  }

  const parent = useContext(Own);
  const provide = useMemo(createOnWillMount, []); 
  useEffect(() => destroyOnUnmount, []);

  return createElement(Own.Provider, { value: provide }, children);
}

function initGroupControllers(
  parent: any,
  explicit: BunchOf<typeof ModelController>,
  fromProps: BunchOf<typeof ModelController> 
){
  const map = create(parent) as BunchOf<ModelController>;

  for(const group of [ fromProps, explicit ])
    for(const key in group){
      if(proto(group[key]) !== Controller)
        continue;

      map[key] = new group[key]();
    }

  for(let layer = map; layer; layer = proto(layer))
  for(const source in layer)
  for(const target in map)
  if(source !== target)
    (map[target] as any)[source] = layer[source];

  return map;
}