import { useEffect } from 'react';

import { ensureReady } from './bootstrap';
import { Controller } from './controller';
import { createSubscription, SUBSCRIBE, UNSUBSCRIBE, useManualRefresh } from './subscriber';
import { Callback, ModelController } from './types';

export function useWatcher(control: ModelController){
  const [ cache, onDidUpdate ] = useManualRefresh();

  let { current } = cache;
  
  if(!current){
    ensureReady(control);
    current = cache.current = createSubscription(control, onDidUpdate);
  }

  useEffect(() => {
    current[SUBSCRIBE]();
    return () => current[UNSUBSCRIBE]();
  }, []);

  return current;
}

export function useWatchedProperty(
  parent: ModelController, key: string, required?: boolean){

  let value = (parent as any)[key];

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

  const [ cache, onDidUpdate ] = useManualRefresh();

  let flushUtilityHooks: undefined | Callback;

  if(value instanceof Controller){
    const instance = value as ModelController;

    //TODO: Changing out instance breaks this.
    flushUtilityHooks = ensureReady(instance);

    if(!cache.current){
      const spy = createSubscription(instance, childDidUpdate);
      const { didFocus } = instance;

      if(didFocus)
        didFocus.call(instance, parent, key);

      cache.current = value = spy;
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
    if(cache.current)
      cache.current[SUBSCRIBE]();
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
    const subscriber = cache.current;

    if(!subscriber)
      return;

    const { willLoseFocus } = subscriber;

    if(willLoseFocus) 
      willLoseFocus(parent, key);

    subscriber[UNSUBSCRIBE]();
    cache.current = null;
  }
}