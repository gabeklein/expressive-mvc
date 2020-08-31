import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { componentLifecycle, subscriberLifecycle, useLifecycleEffect } from './lifecycle';
import { Observer } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

function useMemoWithRefresh<T>(
  init: (onRequestUpdate: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function usePassiveSubscriber
  <T extends { getDispatch(): Observer }>
  (target: T){

  const subscription =
    useMemoWithRefresh(refresh => 
      new Subscription(target.getDispatch(), refresh)
    );

  useEffect(() => {
    subscription.commit();
    return () => subscription.stop();
  }, []);

  return subscription.proxy;
}

export function useActiveSubscriber<T extends Controller>
  (target: T, args: any[]){

  const subscription =
    useMemoWithRefresh(refresh => 
      new Subscription(target.getDispatch(), refresh)
    );

  useLifecycleEffect((name) => {
    const alias = subscriberLifecycle(name);
    const handler = target[alias] || target[name];

    if(name == "didMount")
      subscription.commit();

    if(handler)
      handler.apply(handler, args || []);

    subscription.parent.event(name, alias);

    if(name == "willUnmount")
      subscription.stop();
  });
  
  return subscription.proxy;
}

export function useNewController<T extends typeof Controller>(
  Model: T,
  args?: any[], 
  callback?: (instance: InstanceType<T>) => void){

  let release: Callback | undefined;

  const subscription = 
    useMemoWithRefresh(refresh => 
      new Subscription<Controller>(
        Model.create(args, callback).getDispatch(),
        refresh
      )
    );

  useLifecycleEffect((name) => {
    const instance = subscription.source;
    const alias = componentLifecycle(name);
    const handler = instance[alias] || instance[name];

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    if(name == "didMount")
      subscription.commit();

    if(handler)
      handler.apply(handler, args || []);

    subscription.parent.event(name, alias);

    if(name == "willUnmount"){
      subscription.stop();

      if(release)
        release();

      instance.destroy();
    }
  });

  return subscription.proxy;
}