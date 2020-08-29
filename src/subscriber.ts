import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { subscriberLifecycle, useLifecycleEffect, componentLifecycle } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

function useMemoWithRefresh<T>(
  init: (onRequestUpdate: Callback) => T){

  const [ state, update ] = useState(() => [
    init(() => {
      update(state.concat())
    })
  ]);

  return state[0];
}

export function usePassiveSubscriber<T extends Observable>
  (target: T){

  const subscription =
    useMemoWithRefresh(refresh => {
      return new Subscription(target, refresh);
    });

  useEffect(() => {
    subscription.commit();
    return () => subscription.stop();
  }, []);

  return subscription.proxy;
}

export function useActiveSubscriber<T extends Controller>
  (target: T, args: any[]){

  const subscription =
    useMemoWithRefresh(refresh => {
      return new Subscription(target, refresh);
    });

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
    useMemoWithRefresh(refresh => {
      let instance = Model.create(args, callback);

      return new Subscription(instance, refresh);
    });

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