import { Controller } from './controller';
import { DISPATCH } from './dispatch';
import { Callback, LivecycleEvent, ModelController } from './types';
import { define, Set } from './util';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const UNSUBSCRIBE = Symbol("add_subscription");
export const SUBSCRIBE = Symbol("end_subscription");

export type UpdateTrigger = Callback;
export type ModelEvent = keyof ModelController;

export function createSubscription(
  source: Controller,
  onUpdate: UpdateTrigger,
  onEvent?: (name: LivecycleEvent) => void
){
  const local = Object.create(source);
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
    onEvent: handleEvent,
    refresh: forceRefresh,
    on: alsoWatch,
    only: onlyWatch,
    not: dontWatch
  })

  return local;

  function handleEvent(name: LivecycleEvent){
    if(name == "didMount")
      subscribe();
    if(name == "willUnmount")
      unsubscribe();
    if(onEvent)
      onEvent.call(local, name);
  }

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
