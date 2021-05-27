import { useEffect, useMemo, useState } from 'react';

import { useLookup } from './context';
import { Controller, Model } from './controller';
import { Dispatch } from './dispatch';
import { forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Subscriber } from './subscriber';
import { define, entriesIn, fn } from './util';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

function useRefresh<T>(
  init: (trigger: Callback) => T){

  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

export function usePassive<T extends Model>(
  target: T,
  select?: boolean | string | SelectFunction<any>){

  const instance = target.find(!!select);

  if(!instance)
    return;

  if(fn(select))
    return select(instance);

  if(typeof select == "string")
    return (instance as any)[select];
  
  return instance;
}

export function useWatcher(
  target: {} | (() => {}),
  path?: string | SelectFunction<any>){

  const subscription = useRefresh(trigger => {
    if(fn(target))
      target = target();

    if(fn(path))
      [ path ] = Dispatch.for(target).select(path);

    const sub = new Subscriber(target, trigger);

    if(path)
      sub.focus(path);

    return sub;
  });

  useEffect(() => subscription.listen(!path), []);

  return subscription.proxy;
}

export function useSubscriber(
  target: Controller, args: any[]){

  const subscription = useRefresh(trigger => 
    new Subscriber(target, trigger)
  );

  useLifecycleEffect((name) => {
    if(name == Lifecycle.DID_MOUNT)
      subscription.listen(true);

    const alias = subscriberEvent(name);

    for(const event of [alias, name])
      subscription.parent.emit(event, args);

    if(name == Lifecycle.WILL_UNMOUNT)
      subscription.release();
  });
  
  return subscription.proxy;
}

export function useLazily(
  Type: Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useEffect(() => () => instance.destroy(), []);

  return instance;
}

const ContextUsed = new WeakMap<Controller, boolean>();

function usePeerContext(instance: Controller){
  if(ContextUsed.has(instance)){
    if(ContextUsed.get(instance))
      useLookup();
    return;
  }

  const pending = entriesIn(instance)
    .map(([key, desc]) => [key, desc.value])
    .filter(entry => Controller.isTypeof(entry[1]));

  const hasPeers = pending.length > 0;

  if(hasPeers){
    const local = useLookup();
  
    for(const [key, type] of pending)
      define(instance, key, local.get(type));
  }

  ContextUsed.set(instance, hasPeers);
}

export function useController(
  Type: Model, args: any[], 
  callback?: (instance: Controller) => void){

  const subscription = useRefresh(trigger => {
    const instance = Type.create(...args);

    if(callback)
      callback(instance);

    return new Subscriber(instance, trigger);
  });

  usePeerContext(subscription.subject);

  useLifecycleEffect((name) => {
    if(name == Lifecycle.DID_MOUNT)
      subscription.listen(true);

    const alias = componentEvent(name);

    for(const event of [alias, name])
      subscription.parent.emit(event, []);

    if(name == Lifecycle.WILL_UNMOUNT){
      subscription.release();
      subscription.subject.destroy();
    }
  });

  return subscription.proxy;
}