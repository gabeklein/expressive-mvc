import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { hitLifecycle, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

function useManualRefresh<T>(
  init: (onRequestUpdate: Callback) => T){

  const [ state, update ] = useState(() => [
    init(function onRequestUpdate(){
      update(state.concat());
    })
  ]);

  return state[0];
}

export function usePassiveSubscriber<T extends Observable>
  (target: T){

  const subscription =
    useManualRefresh(update => {
      return new Subscription(target, update);
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
    useManualRefresh(update => {
      initialRender = true;

      return new Subscription(target, update);
    });

  useLifecycleEffect((name) => {
    subscription.handleEvent(name);
    hitLifecycle(target, name, false, args);
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
    useManualRefresh(update => {
      initialRender = true;

      let instance = Model.create(args, callback);

      return new Subscription(instance, update);
    });

  useLifecycleEffect((name) => {
    const instance = subscription.source;

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    subscription.handleEvent(name);
    hitLifecycle(instance, name, true, args);

    if(name == "willUnmount"){
      if(release)
        release();

      instance.destroy();
    }
  }, initialRender);

  return subscription.proxy;
}