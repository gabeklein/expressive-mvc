import { useEffect, useRef, useState, MutableRefObject } from 'react';

import { ModelController } from './controller';
import { Set } from './polyfill';
import { DISPATCH, NEW_SUB, SOURCE, SUBSCRIBE, UNSUBSCRIBE } from './subscription';
import { UpdateTrigger } from './types';

const { 
  defineProperty: define, 
  create
} = Object;

export function useSubscription(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;

  let local = cache.current;

  if(!local){
    local = cache.current = {}

    if(control.elementWillRender)
      control.elementWillRender(local, true)
    
    if(!control[NEW_SUB])
      throw new Error(
        `Can't subscribe to controller; it doesn't contain proper interface for watching.`
      )

    control = control[NEW_SUB](setUpdate) as any;
  }
  else if(control.elementWillRender)
    control.elementWillRender(local)

  useEffect(() => {
    const spyControl = control as unknown as SpyController;
    spyControl[SUBSCRIBE]();

    if(control.elementDidMount)
      control.elementDidMount(local);

    return () => {
      if(control.elementWillUnmount)
        control.elementWillUnmount(local);
      spyControl[UNSUBSCRIBE]()
    };
  }, [])

  return control;
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

  let watch = new Set<string>();
  let exclude: Set<string>;

  for(const key in mutable)
    define(Spy, key, {
      set: (value: any) => mutable[key] = value,
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