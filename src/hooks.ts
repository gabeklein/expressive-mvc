import { useEffect, useMemo, useState } from 'react';

import { Controller, Model } from './controller';
import { componentLifecycle, lifecycle, subscriberLifecycle, useLifecycleEffect } from './lifecycle';
import { Observable } from './observer';
import { attachFromContext } from './context';
import { Subscriber } from './subscriber';
import { entriesIn, isFn, within } from './util';

function useActiveMemo<T>(
  init: (refresh: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function useValue(
  from: Controller, key: string){

  const [ value, onUpdate ] = useState(() => (<Any>from)[key]);

  useEffect(() => from.on(key, onUpdate), []);

  return value;
}

export function usePassiveGetter(
  target: Controller, key?: string){

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
  target: Observable, ...path: (string | undefined)[]){

  const subscription = useActiveMemo(refresh =>
    new Subscriber(target, refresh).focus(path)
  );

  useEffect(() => {
    if(!path[0])
      subscription.commit();
    return () => subscription.release();
  }, []);

  return subscription.proxy;
}

export function useActiveSubscriber(
  target: Controller, args: any[]){

  const subscription = useActiveMemo(refresh => 
    new Subscriber(target, refresh)
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

function getPeersPending(of: Controller){
  const list = [] as [string, Model][];
  for(const [key, { value }] of entriesIn(of))
    if(Controller.isTypeof(value))
      list.push([key, value]);
  return list;
}

export function useOwnController(
  Type: Model, args?: any[], 
  callback?: (instance: Controller) => void){

  let release: Callback | undefined;

  const subscription = useActiveMemo(refresh => {
    const instance = Type.create(args, callback);
    return new Subscriber(instance, refresh);
  });

  useLifecycleEffect((name) => {
    const alias = componentLifecycle(name);
    const instance = subscription.parent.subject as Controller;
    const handler = instance[alias] || instance[name];

    if(name == lifecycle.WILL_RENDER)
      release = attachFromContext(instance, getPeersPending);

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