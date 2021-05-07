import { useEffect, useMemo, useState } from 'react';

import { attachFromContext } from './context';
import { Controller, Model } from './controller';
import { Dispatch } from './dispatch';
import { componentLifecycle, lifecycle, subscriberLifecycle, useLifecycleEffect } from './lifecycle';
import { Subscriber } from './subscriber';
import { fn, within } from './util';

function useActiveMemo<T>(
  init: (refresh: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function usePassive<T extends Controller>(
  target: T, key?: string){

  return useMemo(() => within(target, key), []);
}

export function useWatcher(
  target: {} | (() => {}), ...path: MaybeStrings){

  const subscription = useActiveMemo(refresh => {
    if(typeof target == "function")
      target = target();

    return new Subscriber(target, refresh).focus(path)
  });

  useEffect(() => {
    if(!path[0])
      subscription.commit();
    return () =>
      subscription.release();
  }, []);

  return subscription.proxy;
}

export function useSubscriber(
  target: Controller, args: any[]){

  const subscription = useActiveMemo(refresh => 
    new Subscriber(target, refresh)
  );

  useLifecycleEffect((name) => {
    const { parent } = subscription;
    const alias = subscriberLifecycle(name);
    const handler = target[alias] || target[name];

    if(name == lifecycle.DID_MOUNT)
      subscription.commit();

    if(fn(handler))
      handler.apply(target, args || []);

    parent.emit(name);
    parent.emit(alias);

    if(name == lifecycle.WILL_UNMOUNT)
      subscription.release();
  });
  
  return subscription.proxy;
}

export function useMemoized(
  Type: Model, args: any[]){

  const instance = useMemo(() => Type.create(args), []);

  useLifecycleEffect((name) => {
    const alias = componentLifecycle(name);
    const handler = instance[alias] || instance[name];
    const observer = Dispatch.get(instance);

    if(fn(handler))
      handler.apply(instance, args);

    observer.emit(name);
    observer.emit(alias);

    if(name == lifecycle.WILL_UNMOUNT)
      instance.destroy();
  });

  return instance;
}

export function useController(
  Type: Model, args: any[], 
  callback?: (instance: Controller) => void){

  let release: Callback | undefined;

  const subscription = useActiveMemo(refresh => {
    const instance = Type.create(args, callback);
    return new Subscriber(instance, refresh);
  });

  useLifecycleEffect((name) => {
    const { parent } = subscription;
    const alias = componentLifecycle(name);
    const instance = parent.subject as Controller;
    const handler = instance[alias] || instance[name];

    if(name == lifecycle.WILL_RENDER)
      release = attachFromContext(instance);

    if(name == lifecycle.DID_MOUNT)
      subscription.commit();

    if(fn(handler))
      handler.apply(instance, args);

    parent.emit(name);
    parent.emit(alias);

    if(name == lifecycle.WILL_UNMOUNT){
      subscription.release();

      if(release)
        release();

      instance.destroy();
    }
  });

  return subscription.proxy;
}