import { MutableRefObject, useEffect, useRef, useState } from 'react';

import { DISPATCH, NEW_SUB, SOURCE } from './dispatch';
import { Set } from './polyfill';
import { ModelController, SpyController, UpdateTrigger } from './types';
import { componentLifecycle, RENEW_CONSUMERS, ensureAttachedControllers } from './use_hook';

export const UNSUBSCRIBE = "__delete_subscription__";
export const SUBSCRIBE = "__activate_subscription__";

const ERR_NOT_CONTROLLER = "Can't subscribe to controller; it doesn't contain a proper interface for watching."

const { create, defineProperty: define } = Object;

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
    const spyControl = current as unknown as SpyController;
    spyControl[SUBSCRIBE]();
    return () => spyControl[UNSUBSCRIBE]();
  }, [])

  return current;
}

export function useWatchedValue(
  instance: any, key: string, main?: boolean){

  const dispatch = instance[DISPATCH];
  const setUpdate = useState(0)[1];

  useEffect(() => {
    let watchers: Set<any> = 
      dispatch[key] || (dispatch[key] = new Set());

    watchers.add(setUpdate);

    return () => watchers.delete(setUpdate);
  })

  return instance[key];
}

function subscriberLifecycle(control: ModelController){
  return {
    willRender: control.elementWillRender || control.willRender,
    willUpdate: control.elementWillUpdate || control.willUpdate,
    willUnmount: control.elementWillUnmount || control.willUnmount,
    didMount: control.elementDidMount || control.didMount,
    willMount: control.elementWillMount || control.willMount
  }
}

export function useSubscriber(
  control: ModelController, 
  args: any[], 
  main: boolean){
    
  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount
  } = main 
    ? componentLifecycle(control) 
    : subscriberLifecycle(control)
  
  let local = cache.current;

  if(!local){
    if(!control[NEW_SUB])
      throw new Error(ERR_NOT_CONTROLLER)

    local = control.local = cache.current = {};

    ensureAttachedControllers(control)

    if(willMount)
      willMount.apply(control, args);

    delete control.local;

    control = control[NEW_SUB](setUpdate) as any;
  }
  else {
    control.local = local;

    if(local[RENEW_CONSUMERS])
      local[RENEW_CONSUMERS]()

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

export function createSubscription(
  source: ModelController, 
  hook: UpdateTrigger
): SpyController {

  const mutable = source[SOURCE];
  const register = source[DISPATCH];

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