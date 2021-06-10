import { useEffect, useMemo, useState } from 'react';

import { useLookup } from './context';
import { Controller } from './controller';
import { forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Model } from './model';
import { PendingContext } from './modifiers';
import { Subscriber } from './subscriber';
import { fn, values } from './util';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

function useRefresh<T>(
  init: (trigger: Callback) => T){

  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

type Select = <T>(from: T) => T[keyof T];

export function usePassive<T extends typeof Model>(
  target: T,
  select?: boolean | string | Select){

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
  path?: string | Select){

  const hook = useRefresh(trigger => {
    if(fn(target))
      target = target();

    if(fn(path)){
      const detect = {} as any;

      for(const key in Controller.get(target).state)
        detect[key] = key;

      path = path(detect) as string;
    }

    const sub = new Subscriber(target, trigger);

    if(path)
      sub.focus(path);

    return sub;
  });

  useEffect(() => hook.listen(!path), []);

  return hook.proxy;
}

export function useSubscriber(
  target: Model, args: any[]){

  const hook = useRefresh(trigger => 
    new Subscriber(target, trigger)
  );

  useLifecycleEffect((name) => {
    if(name == Lifecycle.DID_MOUNT)
      hook.listen(true);

    const alias = subscriberEvent(name);

    for(const event of [alias, name])
      hook.parent.emit(event, args);

    if(name == Lifecycle.WILL_UNMOUNT)
      hook.release();
  });
  
  return hook.proxy;
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useEffect(() => () => instance.destroy(), []);

  return instance;
}

const ContextUsed = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  if(ContextUsed.has(instance)){
    if(ContextUsed.get(instance))
      useLookup();
    return;
  }

  const pending = values(instance)
    .filter(x => PendingContext.has(x));

  const hasPeers = pending.length > 0;

  if(hasPeers){
    const local = useLookup();
  
    for(const init of pending)
      init(local);
  }

  ContextUsed.set(instance, hasPeers);
}

export function useModel(
  Type: typeof Model,
  args: any[], 
  callback?: (instance: Model) => void,
  withLifecycle?: boolean){

  const hook = useRefresh(trigger => {
    const instance = Type.create(...args);

    if(callback)
      callback(instance);

    return new Subscriber(instance, trigger);
  });

  usePeerContext(hook.subject);

  if(withLifecycle === false)
    useEffect(() => hook.listen(true), []);
  else
    useLifecycleEffect((name) => {
      if(name == Lifecycle.DID_MOUNT)
        hook.listen(true);

      const alias = componentEvent(name);

      for(const event of [alias, name])
        hook.parent.emit(event, []);

      if(name == Lifecycle.WILL_UNMOUNT){
        hook.release();
        hook.subject.destroy();
      }
    });

  return hook.proxy;
}