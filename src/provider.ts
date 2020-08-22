import { createContext, createElement, PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { Controller, within } from './controller';
import { ensurePeerControllers } from './peers';

export const CONTEXT_MULTIPROVIDER = createContext(null as any);

export function ControlProvider(this: Controller){
  const model = this.constructor as typeof Controller;
  const { Provider } = model.context!;
  
  return (props: PropsWithChildren<any>) => {
    let { children, className, style } = props;

    props = Object.assign({}, props);
    for(const k of ["children", "className", "style"])
      delete props[k];

    if(Object.keys(props).length)
      this.assign(props);

    if(className || style)
      children = createElement("div", { className, style }, children);

    return createElement(Provider, { value: this }, children);
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
      Object.values(provide).forEach(x => x.destroy());
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
          within(map[target], source, layer[source]);

  return map;
}