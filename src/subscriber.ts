import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { Set } from './polyfill';
import { NEW_SUB, SUBSCRIBE, UNSUBSCRIBE } from './subscription';
import { BunchOf, UpdateTrigger } from './types';

const { 
  defineProperty: define, 
  getOwnPropertyDescriptor: describe, 
  create
} = Object;

export function useSubscriber<T extends Controller | SpyController>
  (controller: T){

  const firstRenderIs = useRef(true);
  const useUpdate = useState(0);

  if(firstRenderIs.current){
    const subscribe = controller[NEW_SUB];
    if(!subscribe){
      const { name } = controller.constructor;
      throw new Error(
        `Can't subscribe to controller;` +
        ` this accessor can only be used within { Provider } given to you by \`${name}.use()\``
      )
    }

    controller = subscribe(useUpdate[1]) as any;
    firstRenderIs.current = false
  }

  useEffect(() => {
    const initialRenderControl = 
      controller as SpyController;

    initialRenderControl[SUBSCRIBE]();
    return () => 
      initialRenderControl[UNSUBSCRIBE]();
  }, [])

  return controller;
}

export interface SpyController extends Controller {
  [UNSUBSCRIBE]: () => void;
  [SUBSCRIBE]: () => void;
};

export function SpyController(
  source: Controller, 
  hook: UpdateTrigger,
  mutable: BunchOf<any>,
  register: BunchOf<Set<UpdateTrigger>>
): SpyController {

  const Spy = create(source) as any;
  let watch = Set<string>();
  let exclude: Set<string>;

  for(const key in mutable)
    define(Spy, key, {
      set: describe(source, key)!.set,
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
        set = register[key] = Set();
      set.add(hook);
    }
  }

  function unSub(){
    for(const key of watch)
      register[key].delete(hook);
  }

  function bail(...keys: string[]){
    const watch = Set<string>();
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);
    for(const key of watch)
      register[key].add(hook);
    return source;
  }

  function except(...keys: string[]){
    exclude = Set<string>();
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