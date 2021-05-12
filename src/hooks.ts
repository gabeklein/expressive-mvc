import { useEffect, useMemo, useState } from 'react';

import { attachFromContext } from './context';
import { Controller, Model } from './controller';
import { forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Subscriber } from './subscriber';
import { within } from './util';

export const subscriberEvent = forAlias("element");
export const componentEvent = forAlias("component");

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
  target: {} | (() => {}), ...path: StringsOptional){

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
    if(name == Lifecycle.DID_MOUNT)
      subscription.commit();

    const alias = subscriberEvent(name);

    for(const event of [alias, name])
      subscription.declare(event, args);

    if(name == Lifecycle.WILL_UNMOUNT)
      subscription.release();
  });
  
  return subscription.proxy;
}

export function useMemoized(
  Type: Model, args: any[]){

  const instance = useMemo(() => Type.create(args), []);

  useEffect(() => () => instance.destroy(), []);

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
    const { subject } = subscription;

    if(name == Lifecycle.WILL_RENDER)
      release = attachFromContext(subject);

    if(name == Lifecycle.DID_MOUNT)
      subscription.commit();

    const alias = componentEvent(name);

    for(const event of [alias, name])
      subscription.declare(event);

    if(name == Lifecycle.WILL_UNMOUNT){
      subscription.release();

      if(release)
        release();

      subject.destroy();
    }
  });

  return subscription.proxy;
}