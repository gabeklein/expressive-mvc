import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { triggerLifecycle, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

function useMemoWithRefresh<T>(
  init: (onRequestUpdate: Callback) => T){

  const [ state, update ] = useState(() => [
    init(() => { update(state.concat()) })
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
    subscription.start();
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
    if(name == "didMount")
      subscription.start();

    if(name == "willUnmount")
      subscription.stop();

    triggerLifecycle(target, name, false, args);
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

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    if(name == "didMount")
      subscription.start();

    triggerLifecycle(instance, name, true, args);

    if(name == "willUnmount"){
      subscription.stop();

      if(release)
        release();

      instance.destroy();
    }
  }, initialRender);

  return subscription.proxy;
}