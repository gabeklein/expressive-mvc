import { useEffect, useMemo, useState } from 'react';

import { Controller } from './controller';
import { componentLifecycle, lifecycle, subscriberLifecycle, useLifecycleEffect } from './lifecycle';
import { Observer } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';
import { isFn, within } from './util';

type Observable = { getDispatch(): Observer };

function useActiveMemo<T>(
  init: (refresh: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function usePassiveGetter(
  target: Controller,
  key?: string
){
  return useMemo(() => {
    if(key)
      return within(target, key);
    else
      return {
        get: target,
        set: target,
        ...target
      }
  }, [])
}

export function usePassiveSubscriber(
  target: Observable,
  ...path: (string | undefined)[]){

  const subscription = useActiveMemo(refresh => {
    return new Subscription(target.getDispatch(), refresh).focus(path);
  });

  useEffect(() => {
    subscription.commit();
    return () => subscription.release();
  }, []);

  return subscription.proxy;
}

export function useActiveSubscriber(
  target: Controller, 
  args: any[]){

  const subscription = useActiveMemo(refresh => 
    new Subscription(target.getDispatch(), refresh)
  );

  useLifecycleEffect((name) => {
    const alias = subscriberLifecycle(name);
    const handler = target[alias] || target[name];

    if(name == lifecycle.DID_MOUNT)
      subscription.commit();

    if(isFn(handler))
      handler.apply(target, args || []);

    subscription.parent.emit(name, alias);

    if(name == lifecycle.WILL_UNMOUNT)
      subscription.release();
  });
  
  return subscription.proxy;
}

export function useOwnController(
  Model: typeof Controller,
  args?: any[], 
  callback?: (instance: Controller) => void){

  let release: Callback | undefined;

  const subscription = useActiveMemo(refresh => {
    return new Subscription(
      Model.create(args, callback).getDispatch(),
      refresh
    );
  });

  useLifecycleEffect((name) => {
    const alias = componentLifecycle(name);
    const instance = subscription.parent.subject as Controller;
    const handler = instance[alias] || instance[name];

    if(name == lifecycle.WILL_RENDER)
      release = ensurePeerControllers(instance);

    if(name == lifecycle.DID_MOUNT)
      subscription.commit();

    if(isFn(handler))
      handler.apply(instance, args || []);

    subscription.parent.emit(name, alias);

    if(name == lifecycle.WILL_UNMOUNT){
      subscription.release();

      if(release)
        release();

      instance.destroy();
    }
  });

  return subscription.proxy;
}