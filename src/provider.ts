import {
  createContext,
  createElement,
  PropsWithChildren,
  useEffect,
  useMemo,
  useContext,
} from 'react';
import { BunchOf } from 'types';

import { ModelController } from './controller';

const CONTEXT_MULTIPROVIDER = createContext({} as any);
const isCapital = /^[A-Z]/;

type ControlClass = typeof ModelController;

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
  const { Provider } = CONTEXT_MULTIPROVIDER;
  let {
    children,
    className,
    style,
    using = [],
    ...rest
  } = props;

  if(className || style)
    children = createElement("div", { className, style }, children);

  function createOnMount(){
    return initGroupControllers(using, rest)
  }
  
  function destroyOnUnmount(){
    for(const type in provide)
      provide[type].willDestroy();
  }

  const provide = useMemo(createOnMount, []); 
  useEffect(() => destroyOnUnmount, [])

  return createElement(Provider, { value: provide }, children);
}

function initGroupControllers(
  explicit: Array<ControlClass> = [],
  fromProps: BunchOf<ControlClass> 
){
  const map = {} as BunchOf<ModelController>;
  
  for(const item of explicit){
    const { name } = item;
    if(!name) continue;
    map[name] = new item();
  }

  for(const key in fromProps){
    if(isCapital.test(key) === false)
      continue;

    map[key] = new fromProps[key]();
  }

  for(const source in map)
    for(const target in map)
      if(source !== target)
        (map[target] as any)[source] = map[source];

  return map;
}