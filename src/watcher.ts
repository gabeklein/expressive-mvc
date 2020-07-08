import { useEffect } from 'react';

import { Controller } from './controller';
import { ensureDispatch } from './dispatch';
import { useManualRefresh } from './hook';
import { getObserver, OBSERVER } from './observer';
import { ensurePeerControllers } from './peers';
import { getSubscriber, Subscription } from './subscription';
import { Callback } from './types';

export function useWatcher(control: Controller){
  const [ cache, onDidUpdate ] = useManualRefresh<any>();

  let { current } = cache;
  
  if(!current){
    const subscribe = new Subscription(control, onDidUpdate);
    current = cache.current = subscribe.proxy;
  }

  useEffect(() => {
    const subscribe = getSubscriber(current);

    subscribe.start();
    return () => subscribe.stop();
  }, []);

  return current;
}

//TODO: Reimplement
export function useWatchedProperty<T extends Controller>(
  parent: T, key: string, required?: boolean){

  let value = (parent as any)[key];
  let releaseHooks: Callback | undefined;

  if(value === undefined && required)
    throw new Error(`${parent.constructor.name}.${key} must be defined this render.`)

  const [ cache, onDidUpdate ] = useManualRefresh<{ current: Controller | null }>();

  if(typeof value == "object" && value !== null){
    if(value instanceof Controller){
      ensureDispatch(value);
      //TODO: Changing out instance breaks this.
      releaseHooks = ensurePeerControllers(value);

      const { didFocus } = value;

      if(didFocus)
        didFocus.call(value, parent, key);
    }
  
    if(!cache.current && value[OBSERVER]){
      const subscribe = new Subscription(value, childDidUpdate);
      value = cache.current = subscribe.proxy;
    }
  }

  useEffect(() => {
    const removeListener = 
      getObserver(parent).addListener(key, parentDidUpdate);

    return () => {
      resetSubscription()
      removeListener()
      
      if(releaseHooks)
        releaseHooks()
    }
  }, []);

  useEffect(() => {
    if(cache.current)
      getSubscriber(cache.current).start();
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
    const instance = cache.current;

    if(!instance)
      return;

    if(instance.willLoseFocus)
      instance.willLoseFocus(parent, key);

    getSubscriber(instance).stop();
    cache.current = null;
  }
}