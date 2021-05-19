import { useEffect, useMemo, useState } from 'react';

import { Context } from './context';
import { Controller, Model } from './controller';
import { Dispatch } from './dispatch';
import { forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Subscriber } from './subscriber';
import { define, entriesIn, fn } from './util';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

function useActiveMemo<T>(
  init: (refresh: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function usePassive<T extends Model>(
  target: T,
  select?: boolean | string | SelectFunction<any>){

  const instance = target.find(!!select)!;

  if(fn(select))
    return select(instance);

  if(typeof select == "string")
    return (instance as any)[select];
  
  return instance;
}

export function useWatcher(
  target: {} | (() => {}),
  path?: string | SelectFunction<any>){

  const subscription = useActiveMemo(refresh => {
    if(fn(target))
      target = target();

    if(fn(path))
      [ path ] = Dispatch.for(target).select(path);

    const sub = new Subscriber(target, refresh);

    if(path)
      sub.focus(path);

    return sub;
  });

  useEffect(() => {
    if(!path)
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

const ContextUsed = new WeakMap<Controller, boolean>();

export function usePeerContext(instance: Controller){
  const expected = ContextUsed.get(instance);

  if(expected !== undefined){
    if(expected)
      Context.useLayer();
    return;
  }

  const pending = entriesIn(instance)
    .map(([key, desc]) => [key, desc.value])
    .filter(entry => Controller.isTypeof(entry[1]));

  if(!pending.length)
    ContextUsed.set(instance, false);
  else {
    const ambient = Context.useLayer();
  
    for(const [key, type] of pending)
      define(instance, key, ambient.get(type));
  
    ContextUsed.set(instance, true);
  }
}

export function useController(
  Type: Model, args: any[], 
  callback?: (instance: Controller) => void){

  const subscription = useActiveMemo(refresh => {
    const instance = Type.create(args, callback);

    return new Subscriber(instance, refresh);
  });

  usePeerContext(subscription.subject);

  useLifecycleEffect((name) => {
    if(name == Lifecycle.DID_MOUNT)
      subscription.commit();

    const alias = componentEvent(name);

    for(const event of [alias, name])
      subscription.declare(event);

    if(name == Lifecycle.WILL_UNMOUNT){
      subscription.release();
      subscription.subject.destroy();
    }
  });

  return subscription.proxy;
}