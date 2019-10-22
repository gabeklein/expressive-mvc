import { useEffect, useRef, useState } from 'react';

import { ModelController } from './controller';
import { Set } from './polyfill';
import { DISPATCH, NEW_SUB, SOURCE, SUBSCRIBE, UNSUBSCRIBE } from './subscription';
import { UpdateTrigger } from './types';

const { 
  defineProperty: define, 
  getOwnPropertyDescriptor: describe,
  getPrototypeOf: prototypeOf, 
  create
} = Object;

export function useSubscriber(controller: ModelController){
  let instance: ModelController | SpyController = controller;
  const firstRenderIs = useRef(true);
  const setUpdate = useState(0)[1];

  if(firstRenderIs.current){
    const subscribe = controller[NEW_SUB];
    if(!subscribe){
      const { name } = controller.constructor;
      throw new Error(
        `Can't subscribe to controller;` +
        ` this accessor can only be used within { Provider } given to you by \`${name}.use()\``
      )
    }

    instance = subscribe(setUpdate);
    firstRenderIs.current = false
  }

  useEffect(() => {
    const initialRenderControl = instance as unknown as SpyController;
    initialRenderControl[SUBSCRIBE]();
    return () => initialRenderControl[UNSUBSCRIBE]();
  }, [])

  return instance;
}

export interface SpyController extends ModelController {
  [UNSUBSCRIBE]: () => void;
  [SUBSCRIBE]: () => void;
};

export function SpyController(
  source: ModelController, 
  hook: UpdateTrigger
): SpyController {

  const {
    [SOURCE]: mutable,
    [DISPATCH]: register
  } = source;

  const Spy = create(source);
  const inner = prototypeOf(source);

  let watch = new Set<string>();
  let exclude: Set<string>;

  for(const key in mutable)
    define(Spy, key, {
      set: describe(inner, key)!.set,
      get: () => {
        watch.add(key);
        return mutable[key];
      }
    })

  define(Spy, SUBSCRIBE, { value: sub });
  define(Spy, UNSUBSCRIBE, { value: unSub });
  define(Spy, "once", { value: () => source });
  define(Spy, "on", { value: also });
  define(Spy, "only", { value: bail });
  define(Spy, "not", { value: except });

  return Spy;

  function sub(){
    if(exclude)
    for(const k of exclude)
      watch.delete(k);

    for(const key of watch){
      let set = register[key];
      if(!set)
        set = register[key] = new Set();
      set.add(hook);
    }
  }

  function unSub(){
    for(const key of watch)
      register[key].delete(hook);
  }

  function bail(...keys: string[]){
    const watch = new Set<string>();
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);
    for(const key of watch)
      register[key].add(hook);
    return source;
  }

  function except(...keys: string[]){
    exclude = new Set<string>();
    for(let arg of keys)
      for(const key of arg.split(","))
        exclude.add(key);
    return Spy;
  }

  function also(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
      watch.add(key);
    return Spy;
  }
}