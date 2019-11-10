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

const CONTEXT_MULTIPROVIDER = createContext(null as any);
const isCapitalized = /^[A-Z]/;

const { create, getPrototypeOf: proto } = Object;

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
  explicit: BunchOf<ControlClass>,
  fromProps: BunchOf<ControlClass> 
){
  const map = create(parent) as BunchOf<ModelController>;

  for(const group of [ fromProps, explicit ])
    for(const key in group){
      if(isCapitalized.test(key) === false)
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