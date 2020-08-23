import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { componentLifecycle, LivecycleEvent, subscriberLifecycle, useEventDrivenController } from './hook';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { SUBSCRIPTION, Subscription } from './subscription';

export function useModelController(
  model: typeof Controller, 
  args: any[] = [], 
  callback?: (instance: Controller) => void){

  return useEventDrivenController((refresh) => {
    let instance = model.create(args);
    let release: Callback | undefined;

    const dispatch = instance.initialize();

    if(callback)
      callback(instance);

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = componentLifecycle[name] as LivecycleEvent;
      const handler = instance[specific] || instance[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.trigger(name, specific);

      switch(name){
        case "willRender":
          release = ensurePeerControllers(this);
        break;

        case "willUnmount": {
          if(release)
            release();

          instance.destroy();
        }
        break;
      }
    }

    return new Subscription(instance, refresh, onEvent).proxy;
  })
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

export function useSubscriber<T extends Controller>(
  target: T,
  args: any[],
  main: boolean){

  return useEventDrivenController((refresh) => {
    const dispatch = target.initialize();
    
    const lifecycle: any = main
      ? componentLifecycle
      : subscriberLifecycle;

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = lifecycle[name] as LivecycleEvent;
      const handler = target[specific] || target[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.trigger(name, specific);
    }
    
    return new Subscription(target, refresh, onEvent).proxy;
  })
}