import { useEffect, useMemo, useState } from 'react';

import { Controller } from './controller';
import { hitLifecycle, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { SUBSCRIPTION, Subscription } from './subscription';

function useManualRefresh(){
  const [ state, update ] = useState([
    // This is a noop, but will force an update.
    // Simply juggles the same callback repeatedly.
    () => { update(state.concat()) }
  ])

  return state[0];
}

export function useModelController(
  model: typeof Controller, 
  args: any[] = [], 
  callback?: (instance: Controller) => void){

  let initial = false;
  let release: Callback | undefined;

  const onShouldUpdate = useManualRefresh();

  const instance = useMemo(() => {
    let instance = model.create(args);

    initial = true;
    instance.ensureDispatch();

    if(callback)
      callback(instance);

    const subscription = 
      new Subscription(instance, onShouldUpdate);

    return subscription.proxy;
  }, []);

  useLifecycleEffect((name) => {
    if(name == "willRender")
      release = ensurePeerControllers(instance);

    instance[SUBSCRIPTION]!.handleEvent(name);
    hitLifecycle(instance, name, args, true);

    if(name == "willUnmount"){
      if(release)
        release();

      instance.destroy();
    }
  }, initial);

  return instance;
}

export function useSubscriber<T extends Controller>(
  target: T, args: any[], main: boolean){

  let initial = false;

  const onShouldUpdate = useManualRefresh();

  target = useMemo(() => {
    initial = true;
    target.ensureDispatch();

    const subscription = 
      new Subscription(target, onShouldUpdate);

    return subscription.proxy;
  }, []);

  useLifecycleEffect((name) => {
    target[SUBSCRIPTION]!.handleEvent(name);
    hitLifecycle(target, name, args, main);
  }, initial);
  
  return target;
}

export function useLazySubscriber<T extends Observable>(control: T){
  const onShouldUpdate = useManualRefresh();

  control = useMemo(() => {
    return new Subscription(control, onShouldUpdate).proxy;
  }, []);

  useEffect(() => {
    const subscription = control[SUBSCRIPTION];
  
    if(!subscription)
      throw new Error("Subscription does not exist on this object.")

    subscription.start();
    return () => subscription.stop();
  }, []);

  return control;
}