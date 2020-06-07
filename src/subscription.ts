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
  let releaseHooks: Callback | undefined;
  
  if(!control){
    control = init() as Controller;
    trigger = (name: ModelEvent) => onEvent(control, name);
    cache.eventListener = trigger;
    Dispatch.readyFor(control);
  }

  releaseHooks = ensureAttachedControllers(control);

  if(!cache.current){
    control = cache.current = 
      createSubscription(control, onShouldUpdate) as any;

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
  source: Controller,
  onUpdate: UpdateTrigger
): Controller {

  const Spy = Object.create(source);
  const dispatch = source[DISPATCH]!;
  const { refresh, subscribers } = dispatch;
  const watch = new Set<string>();

  let exclude: Set<string>;
  let cleanup: Set<Callback>;

  for(const key in subscribers){
    Object.defineProperty(Spy, key, {
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
  }

  define(Spy, SUBSCRIBE, subscribe)
  define(Spy, UNSUBSCRIBE, unsubscribe)
  define(Spy, {
    refresh: forceRefresh,
    on: alsoWatch,
    only: onlyWatch,
    not: dontWatch
  })

  return Spy;

  function forceRefresh(...keys: string[]){
    if(!keys[0]) onUpdate();
    else refresh(...keys)
  }

  function stopInference(){
    for(const key in subscribers)
      delete Spy[key];
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
        
    return Spy;
  }

  function alsoWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    return Spy;
  }

  function onlyWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    stopInference();

    return Spy;
  }
}
