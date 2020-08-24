import { useEffect, useMemo, useState } from 'react';

import { Controller } from './controller';
import { hitLifecycle, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

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

  const subscription = useMemo(() => {
    let instance = model.create(args);

    initial = true;
    instance.ensureDispatch();

    if(callback)
      callback(instance);

    return new Subscription(instance, onShouldUpdate);
  }, []);

  useLifecycleEffect((name) => {
    const instance = subscription.source;

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    subscription.handleEvent(name);
    hitLifecycle(instance, name, args, true);

    if(name == "willUnmount"){
      if(release)
        release();

      instance.destroy();
    }
  }, initial);

  return subscription.proxy;
}

export function useSubscriber<T extends Controller>(
  target: T, args: any[], main: boolean){

  let initial = false;

  const onShouldUpdate = useManualRefresh();

  const subscription = useMemo(() => {
    initial = true;
    target.ensureDispatch();

    return new Subscription(target, onShouldUpdate);
  }, []);

  useLifecycleEffect((name) => {
    subscription.handleEvent(name);
    hitLifecycle(target, name, args, main);
  }, initial);
  
  return subscription.proxy;
}

export function useSimpleSubscriber<T extends Observable>(control: T){
  const onShouldUpdate = useManualRefresh();

  const subscription = useMemo(() => {
    return new Subscription(control, onShouldUpdate);
  }, []);

  useEffect(() => {
    subscription.start();
    return () => subscription.stop();
  }, []);

  return subscription.proxy;
}