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

  let initialRender = false;

  const subscription =
    useMemoWithRefresh(refresh => {
      initialRender = true;

      return new Subscription(target, refresh);
    });

  useLifecycleEffect((name) => {
    subscription.event(name);
    triggerLifecycle(target, name, false, args);
  }, initialRender);
  
  return subscription.proxy;
}

export function useNewController<T extends typeof Controller>(
  Model: T,
  args?: any[], 
  callback?: (instance: InstanceType<T>) => void){

  let initialRender = false;
  let release: Callback | undefined;

  const subscription = 
    useMemoWithRefresh(refresh => {
      initialRender = true;

      let instance = Model.create(args, callback);

      return new Subscription(instance, refresh);
    });

  useLifecycleEffect((name) => {
    const instance = subscription.source;

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    subscription.event(name);
    triggerLifecycle(instance, name, true, args);

    if(name == "willUnmount"){
      if(release)
        release();

      instance.destroy();
    }
  }, initialRender);

  return subscription.proxy;
}