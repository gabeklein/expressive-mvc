import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { createSubscription } from './subscriber';
import { ModelController, RENEW_CONSUMERS, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';
import { initializeController } from './use_hook';

export function useWatcher(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    Dispatch.applyTo(control);
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
  parent: ModelController, key: string, required?: boolean){

  const value = (parent as any)[key];

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

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
    const removeListener = 
      parent.dispatch.addListener(key, parentDidUpdate);

    return () => {
      if(subscription.current)
        deallocate(subscription.current)

      removeListener()
    }
  }, []);

  useEffect(() => {
    if(subscription.current)
      subscription.current[SUBSCRIBE]();
  }, [value])

  if(value instanceof Controller){
    const instance = value as ModelController;

    if(subscription.current){
      const hookMaintenance = instance[RENEW_CONSUMERS];
      if(hookMaintenance)
        hookMaintenance()

      return instance;
    }
    else {
      Dispatch.applyTo(instance);
      initializeController(instance);

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