import { DISPATCH } from './dispatch';
import { Callback, ModelController } from './types';
import { define, Set } from './util';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const UNSUBSCRIBE = Symbol("add_subscription");
export const SUBSCRIBE = Symbol("end_subscription");

export type UpdateTrigger = Callback;

//TODO: Turn this into a class like Dispatch
export function createSubscription(
  source: ModelController,
  onUpdate: UpdateTrigger
): ModelController {

  const Spy = Object.create(source);
  const dispatch = source[DISPATCH]!;
  const { current, refresh } = dispatch;
  const watch = new Set<string>();

  let exclude: Set<string>;
  let cleanup: Set<Callback>;

  for(const key in current)
    Object.defineProperty(Spy, key, {
      configurable: true,
      enumerable: true,
      set: (value: any) => {
        current[key] = value;
        refresh(key);
      },
      get: () => {
        watch.add(key);
        return current[key];
      }
    })

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
    for(const key in current)
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
