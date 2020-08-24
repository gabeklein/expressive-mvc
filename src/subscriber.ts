import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { LivecycleEvent, useLifecycleEffect, hitLifecycle } from "./lifecycle";
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

    function onEvent(this: Controller, name: LivecycleEvent){
      hitLifecycle(instance, name, args, true);

      if(name == "willRender")
        release = ensurePeerControllers(instance);

      if(name == "willUnmount"){
        if(release)
          release();

        instance.destroy();
      }
    }

    const subscription = new Subscription(instance, refresh, onEvent);
    
    state.current = subscription.proxy;
    state.onEvent = (name) => subscription.handleEvent(name);

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

    function onEvent(this: Controller, name: LivecycleEvent){
      hitLifecycle(target, name, args, main);
    }

    const subscription = new Subscription(target, refresh, onEvent);
    
    state.current = subscription.proxy;
    state.onEvent = (name) => subscription.handleEvent(name);

    initial = true;
  }

  useLifecycleEffect(state.onEvent, initial);
  
  return state.current;
}

export function useLazySubscriber(control: Observable){
  const [ cache, refresh ] = useState({} as any);
  const onDidUpdate = () => refresh(Object.assign({}, cache));

  let { current } = cache;
  
  if(!current){
    const subscribe = new Subscription(control, onDidUpdate);
    current = cache.current = subscribe.proxy;
  }

  useEffect(() => {
    const subscribe = current[SUBSCRIPTION];
  
    if(!subscribe)
      throw new Error("Subscription does not exist on this object.")

    subscribe.start();
    return () => subscribe.stop();
  }, []);

  return current;
}