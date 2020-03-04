import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { DISPATCH, NEW_SUB, SOURCE } from './dispatch';
import { Set } from './polyfill';
import { ModelController, SpyController, UpdateTrigger } from './types';
import { componentLifecycle, ensureAttachedControllers, RENEW_CONSUMERS } from './use_hook';

export const UNSUBSCRIBE = "__delete_subscription__";
export const SUBSCRIBE = "__activate_subscription__";

const ERR_NOT_CONTROLLER = "Can't subscribe to controller; it doesn't contain a proper interface for watching."

const { create, defineProperty: define } = Object;

function subscriberLifecycle(control: ModelController){
  return {
    willRender: control.elementWillRender || control.willRender,
    willUpdate: control.elementWillUpdate || control.willUpdate,
    willUnmount: control.elementWillUnmount || control.willUnmount,
    didMount: control.elementDidMount || control.didMount,
    willMount: control.elementWillMount || control.willMount
  }
}

export function useWatcher(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    if(!control[NEW_SUB])
      throw new Error(ERR_NOT_CONTROLLER)

    current = cache.current = control[NEW_SUB](setUpdate) as any;
  }

  useEffect(() => {
    const listener = current as SpyController;
    listener[SUBSCRIBE]();
    return () => listener[UNSUBSCRIBE]();
  }, [])

  return current;
}

export function useWatchedProperty(
  parent: any, key: string, main?: boolean){

  const value = parent[key];
  const dispatch = parent[DISPATCH];
  const watchers = dispatch[key] || (dispatch[key] = new Set());
  const setRefresh = useState(0)[1];
  const subscription = useRef<SpyController | null>(null);

  function childDidUpdate(beat: number){
    setRefresh(beat);
  }

  function parentDidUpdate(beat: number){
    if(subscription.current)
      deallocate(subscription.current)

    setRefresh(beat);
  };

  function deallocate(subscriber: SpyController){
    const unfocus = 
      subscriber.elementWillLoseFocus || 
      subscriber.willLoseFocus;

    if(unfocus) 
      unfocus(parent, key);

    subscriber[UNSUBSCRIBE]();
    subscription.current = null;
  }

  useEffect(() => {
    watchers.add(parentDidUpdate);

    return () => {
      if(subscription.current)
        deallocate(subscription.current)

      watchers.delete(parentDidUpdate)
    }
  }, []);

  useEffect(() => {
    if(subscription.current)
      subscription.current[SUBSCRIBE]();
  }, [value])

  if(value instanceof Controller){
    const instance = value as ModelController;

    if(!subscription.current){
      if(!instance[NEW_SUB])
        throw new Error(ERR_NOT_CONTROLLER)

      ensureAttachedControllers(instance);

      const didFocus = instance.elementDidFocus || instance.didFocus;

      if(didFocus)
        didFocus.call(instance, parent, key);

      const spy = subscription.current = instance[NEW_SUB](childDidUpdate);
      return spy;
    }
    else {
      if(instance[RENEW_CONSUMERS])
        instance[RENEW_CONSUMERS]!()

      return instance;
    }
  }
  else
    return value;
}

export function useSubscriber(
  control: ModelController, 
  args: any[], 
  main: boolean){
    
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

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