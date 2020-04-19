import { useEffect, useRef } from 'react';

import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { createSubscription, useRefresh } from './subscriber';
import { ModelController, RENEW_CONSUMERS, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';
import { ensureAttachedControllers } from './use_hook';

export function useWatcher(control: ModelController){
  const onDidUpdate = useRefresh();
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    Dispatch.applyTo(control);
    ensureAttachedControllers(control);
    current = cache.current = createSubscription(control, onDidUpdate);
  }

  useEffect(() => {
    const listener = current as SpyController;
    listener[SUBSCRIBE]();
    return () => listener[UNSUBSCRIBE]();
  }, [])

  return current;
}

export function useWatchedProperty(
  parent: ModelController, key: string, required?: boolean){

  const value = (parent as any)[key];

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

  const onDidUpdate = useRefresh();
  const subscription = useRef<SpyController | null>(null);

  useEffect(() => {
    const removeListener = 
      parent.dispatch!.addListener(key, parentDidUpdate);

    return () => {
      clearSubscription()
      removeListener()
    }
  }, []);

  useEffect(() => {
    if(subscription.current)
      subscription.current[SUBSCRIBE]();
  }, [value])

  if(value instanceof Controller)
    return newSubscription()
  else
    return value;

  /* Subroutines */

  function childDidUpdate(){
    onDidUpdate();
  }

  function parentDidUpdate(){
    clearSubscription();
    onDidUpdate();
  };

  function clearSubscription(){
    const subscriber = subscription.current;

    if(!subscriber)
      return;

    const unfocus = 
      subscriber.elementWillLoseFocus || 
      subscriber.willLoseFocus;

    if(unfocus) 
      unfocus(parent, key);

    subscriber[UNSUBSCRIBE]();
    subscription.current = null;
  }

  function newSubscription(){
    const instance = value as ModelController;

    if(subscription.current){
      const hookMaintenance = instance[RENEW_CONSUMERS];
      if(hookMaintenance)
        hookMaintenance()

      return instance;
    }
    else {
      Dispatch.applyTo(instance);
      ensureAttachedControllers(instance);

      const spy = createSubscription(instance, childDidUpdate);
      const { didFocus } = instance;

      if(didFocus)
        didFocus.call(instance, parent, key);

      subscription.current = spy;
      return spy;
    }
  }
}