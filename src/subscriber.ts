import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { DISPATCH, NEW_SUB, SOURCE, SUBSCRIBE, UNSUBSCRIBE } from './controller';
import { Set } from './polyfill';
import { ModelController, UpdateTrigger, SpyController } from './types';

const ERR_NOT_CONTROLLER = "Can't subscribe to controller; it doesn't contain a proper interface for watching."

const { 
  defineProperty: define, 
  create
} = Object;

export function useWatcher(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;

  let { current } = cache;
  
  if(!current){
    if(!control[NEW_SUB])
      throw new Error(ERR_NOT_CONTROLLER)

    current = cache.current = control[NEW_SUB](setUpdate) as any;
  }

  useEffect(() => {
    const spyControl = control as unknown as SpyController;
    spyControl[SUBSCRIBE]();
    return () => spyControl[UNSUBSCRIBE]();
  }, [])

  return control;
}

export function useSubscriber(control: ModelController, args: any[]){
  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;

  const willRender = control.elementWillRender || control.willRender;
  const willUpdate = control.elementWillUpdate || control.willUpdate;
  const willUnmount = control.elementWillUnmount || control.willUnmount;
  const didMount = control.elementDidMount || control.didMount;
  const willMount = control.elementWillMount || control.willMount;
  
  let local = cache.current;

  if(!local){
    local = control.local = cache.current = {}

    if(willMount)
        willMount.apply(control, args);

    delete control.local;

    if(!control[NEW_SUB])
      throw new Error(ERR_NOT_CONTROLLER)

    control = control[NEW_SUB](setUpdate) as any;
  }
  else {
    control.local = local;

    if(willUpdate)
      willUpdate.apply(control, args);
  }

  if(willRender)
    willRender.apply(control, args)

  delete control.local;

  useEffect(() => {
    const spyControl = control as unknown as SpyController;
    spyControl[SUBSCRIBE]();

    if(didMount){
      control.local = local;
      didMount.apply(control, args);
      delete control.local;
    }

    return () => {
      if(willUnmount){
        control.local = local;
        willUnmount.apply(control, args);
        delete control.local;
      }
      spyControl[UNSUBSCRIBE]()
    };
  }, [])

  return control;
}

export function Subscription(
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