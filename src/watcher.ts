import { useEffect, useRef } from 'react';

import { Controller } from './controller';
import { createSubscription, useRefresh } from './subscriber';
import { Callback, ModelController, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';
import { ensureBootstrap } from './bootstrap';

export function useWatcher(control: ModelController){
  const onDidUpdate = useRefresh();
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    ensureBootstrap(control);
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

  let value = (parent as any)[key];

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

  const onDidUpdate = useRefresh();
  const subscription = useRef<SpyController | null>(null);
  let flushUtilityHooks: undefined | Callback;

  if(value instanceof Controller){
    const instance = value as ModelController;

    //TODO: Changing out instance breaks this.
    flushUtilityHooks = ensureBootstrap(instance);

    if(!subscription.current){
      const spy = createSubscription(instance, childDidUpdate);
      const { didFocus } = instance;

      if(didFocus)
        didFocus.call(instance, parent, key);

      subscription.current = value = spy;
    } 
  }

  useEffect(() => {
    const removeListener = 
      parent.dispatch!.addListener(key, parentDidUpdate);

    return () => {
      resetSubscription()
      removeListener()
      
      if(flushUtilityHooks)
        flushUtilityHooks()
    }
  }, []);

  useEffect(() => {
    if(subscription.current)
      subscription.current[SUBSCRIBE]();
  }, [value])

  return value;

  /* Subroutines */

  function childDidUpdate(){
    onDidUpdate();
  }

  function parentDidUpdate(){
    resetSubscription();
    onDidUpdate();
  };

  function resetSubscription(){
    const subscriber = subscription.current;

    if(!subscriber)
      return;

    const { willLoseFocus } = subscriber;

    if(willLoseFocus) 
      willLoseFocus(parent, key);

    subscriber[UNSUBSCRIBE]();
    subscription.current = null;
  }
}