import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { hitLifecycle, LivecycleEvent, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { SUBSCRIPTION, Subscription } from './subscription';

export function useModelController(
  model: typeof Controller, 
  args: any[] = [], 
  callback?: (instance: Controller) => void){

  const [ state, forceUpdate ] = useState({} as {
    current: InstanceType<typeof model>,
    onEvent: (name: LivecycleEvent) => void
  });

  let initial = false;

  if(!state.current){
    let instance = model.create(args);
    let release: Callback | undefined;

    const refresh = () => forceUpdate({ ...state });
    instance.ensureDispatch();

    if(callback)
      callback(instance);

    const subscription = new Subscription(instance, refresh);

    state.current = subscription.proxy;
    state.onEvent = (name) => {
      if(name == "willRender")
        release = ensurePeerControllers(instance);

      subscription.handleEvent(name);
      hitLifecycle(instance, name, args, true);

      if(name == "willUnmount"){
        if(release)
          release();

        instance.destroy();
      }
    };

    initial = true;
  }

  useLifecycleEffect(state.onEvent, initial);
  
  return state.current;
}

export function useSubscriber<T extends Controller>(
  target: T, args: any[], main: boolean){

  const [ state, forceUpdate ] = useState({} as {
    current: T,
    onEvent: (name: LivecycleEvent) => void
  });

  let initial = false;

  if(!state.current){
    const refresh = () => forceUpdate({ ...state });
    target.ensureDispatch();

    const subscription = new Subscription(target, refresh);

    state.current = subscription.proxy;
    state.onEvent = (name) => {
      subscription.handleEvent(name);
      hitLifecycle(target, name, args, main);
    };

    initial = true;
  }

  useLifecycleEffect(state.onEvent, initial);
  
  return state.current;
}

export function useLazySubscriber<T extends Observable>(control: T){
  const [ cache, refresh ] = useState({} as any);
  const onDidUpdate = () => refresh({ ...cache });

  let { current } = cache;
  
  if(!current){
    const subscribe = new Subscription(control, onDidUpdate);
    current = cache.current = subscribe.proxy;
  }

  useEffect(() => {
    const subscription = current[SUBSCRIPTION];
  
    if(!subscription)
      throw new Error("Subscription does not exist on this object.")

    subscription.start();
    return () => subscription.stop();
  }, []);

  return current;
}