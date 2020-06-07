import { useEffect, useState } from 'react';

import { ensureAttachedControllers } from './bootstrap';
import { Controller } from './controller';
import { DISPATCH, Dispatch } from './dispatch';
import { Callback, ModelController } from './types';
import { define, Set } from './util';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const UNSUBSCRIBE = Symbol("add_subscription");
export const SUBSCRIBE = Symbol("end_subscription");

export type UpdateTrigger = Callback;
export type ModelEvent = keyof ModelController;

export const useManualRefresh = <T extends {}>(init?: () => T) => {
  const [ state, update ] = useState<T>(init || {} as any);
  const refresh = () => update(Object.assign({}, state));
  return [ state, refresh ] as const;
}

export function useSubscription(
  init: () => ModelController,
  onEvent: (instance: Controller, name: ModelEvent) => any
){
  const [ cache, onShouldUpdate ] = useManualRefresh();
  
  let control: Controller = cache.current;
  let trigger = cache.eventListener;
  
  if(!control){
    control = init() as Controller;
    trigger = (name: ModelEvent) => onEvent(control, name);
    cache.eventListener = trigger;
    Dispatch.readyFor(control);
  }

  const releaseHooks = ensureAttachedControllers(control);

  if(!cache.current){
    control = cache.current = Object.create(control);
    createSubscription(control, onShouldUpdate);

    trigger("willMount");
  }
  else
    trigger("willUpdate");

  trigger("willRender");

  useEffect(() => {
    let onEndOfLife = trigger("willCycle");

    trigger("didMount");

    control[SUBSCRIBE]!();

    return () => {
      control[UNSUBSCRIBE]!();

      if(releaseHooks)
        releaseHooks();

      trigger("willUnmount");

      if(typeof onEndOfLife === "function")
        onEndOfLife();
    };
  }, [])

  return control;
}

export function createSubscription(
  local: Controller,
  onUpdate: UpdateTrigger
){
  const source = Object.getPrototypeOf(local);
  const dispatch = local[DISPATCH]!;
  const watch = new Set<string>();

  let exclude: Set<string>;
  let cleanup: Set<Callback>;

  for(const key in dispatch.subscribers)
    Object.defineProperty(local, key, {
      configurable: true,
      enumerable: true,
      set: (value: any) => {
        (source as any)[key] = value
      },
      get: () => {
        watch.add(key);
        return (source as any)[key];
      }
    })

  define(local, SUBSCRIBE, subscribe)
  define(local, UNSUBSCRIBE, unsubscribe)
  define(local, {
    refresh: forceRefresh,
    on: alsoWatch,
    only: onlyWatch,
    not: dontWatch
  })

  function forceRefresh(...keys: string[]){
    if(!keys[0]) onUpdate();
    else dispatch.refresh(...keys)
  }

  function stopInference(){
    for(const key in dispatch.subscribers)
      delete (local as any)[key];
  }

  function subscribe(){
    stopInference();

    if(exclude)
      for(const k of exclude)
        watch.delete(k);

    if(watch.size === 0)
      return;

    cleanup = new Set();
    for(const key of watch){
      const done = dispatch.addListener(key, onUpdate);
      cleanup.add(done)
    }
  }

  function unsubscribe(){
    if(cleanup)
      for(const unsub of cleanup)
        unsub()
  }

  function dontWatch(...keys: string[]){
    exclude = new Set();

    for(let arg of keys)
      for(const key of arg.split(","))
        exclude.add(key);
        
    return local;
  }

  function alsoWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    return local;
  }

  function onlyWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    stopInference();

    return local;
  }
}
