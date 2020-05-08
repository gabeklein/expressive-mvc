import { useEffect } from 'react';

import { ensureAttachedControllers } from './bootstrap';
import { Controller } from './controller';
import { DISPATCH, Dispatch } from './dispatch';
import { useManualRefresh } from './hook';
import { createSubscription, SUBSCRIBE, UNSUBSCRIBE } from './subscription';
import { Callback } from './types';

export function useWatcher(control: Controller){
  const [ cache, onDidUpdate ] = useManualRefresh();

  let { current } = cache;
  
  if(!current){
    Dispatch.readyFor(control);
    current = cache.current = createSubscription(control, onDidUpdate);
  }

  useEffect(() => {
    current[SUBSCRIBE]();
    return () => current[UNSUBSCRIBE]();
  }, []);

  return current;
}

export function useWatchedProperty<T extends Controller>(
  parent: T, key: string, required?: boolean){

  let value = (parent as any)[key];
  let releaseHooks: Callback | undefined;

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

  const [ cache, onDidUpdate ] = useManualRefresh();

  if(typeof value == "object" && value !== null){
    if(value instanceof Controller){
      Dispatch.readyFor(value);
      //TODO: Changing out instance breaks this.
      releaseHooks = ensureAttachedControllers(value);

      const { didFocus } = value;

      if(didFocus)
        didFocus.call(value, parent, key);
    }
  
    if(!cache.current && DISPATCH in value)
      value = cache.current = createSubscription(value, childDidUpdate);
  }

  useEffect(() => {
    const removeListener = 
      parent[DISPATCH]!.addListener(key, parentDidUpdate);

    return () => {
      resetSubscription()
      removeListener()
      
      if(releaseHooks)
        releaseHooks()
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