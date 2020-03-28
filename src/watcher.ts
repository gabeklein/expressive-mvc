import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { createDispatch, DISPATCH } from './dispatch';
import { Set } from './polyfill';
import { createSubscription, SUBSCRIBE, UNSUBSCRIBE } from './subscriber';
import { ModelController, SpyController } from './types';
import { ensureAttachedControllers, RENEW_CONSUMERS } from './use_hook';


export function useWatcher(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    createDispatch(control);
    current = cache.current = createSubscription(control, setUpdate);
  }

  useEffect(() => {
    const listener = current as SpyController;
    listener[SUBSCRIBE]();
    return () => listener[UNSUBSCRIBE]();
  }, [])

  return current;
}

export function useWatchedProperty(
  parent: any, key: string, required?: boolean){

  const value = parent[key];

  if(value === undefined && required)
    throw new Error(`${parent.name}.${key} must be defined this render.`)

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

    if(subscription.current){
      const hookMaintainance = instance[RENEW_CONSUMERS];
      if(hookMaintainance)
        hookMaintainance()

      return instance;
    }
    else {
      createDispatch(instance);
      ensureAttachedControllers(instance);

      const spy = createSubscription(instance, childDidUpdate);
      const didFocus = instance.elementDidFocus || instance.didFocus;

      if(didFocus)
        didFocus.call(instance, parent, key);

      subscription.current = spy;
      return spy;
    }
  }
  else
    return value;
}