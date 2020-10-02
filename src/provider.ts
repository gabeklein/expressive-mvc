import { createContext, createElement, FC, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { Controller } from './controller';
import { ensurePeerControllers } from './peers';
import { useOwnController } from './subscriber';
import { within } from './util';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

export function ControlProvider(this: Controller){
  const model = this.constructor as typeof Controller;
  const { Provider } = model.__context__!;
  
  return (props: PropsWithChildren<any>) => {
    let { children, className, style, ...outsideProps } = props;

    if(Object.keys(outsideProps).length)
      this.update(outsideProps);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: this }, children);
  }
}

export function createWrappedComponent(
  this: typeof Controller, fn: FC<any>){

  const { Provider } = this.__context__!;
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const self = useOwnController(this);
    const current = self.__dispatch__;

    self.assign(forwardedProps);
    
    return createElement(Provider, { value: self }, 
      createElement(fn, { self, ...current.values })
    )
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

  const Multi = CONTEXT_MULTIPROVIDER;

  if(className || style)
    children = createElement("div", { className, style }, children);

  let flushHooks = [] as Callback[];

  const parent = useContext(Multi);
  const provide = useMemo(() =>
    initGroupControllers(parent, controllers, outsideProps),
  []); 

  Object.values(provide).forEach(mc => {
    const onDidUnmount = ensurePeerControllers(mc);
    if(onDidUnmount)
      flushHooks.push(onDidUnmount);
  })

  useEffect(() => () => {
    flushHooks.forEach(x => x());
    Object.values(provide).forEach(x => x.destroy());
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
          within(map[target], source, layer[source]);

  return map;
}