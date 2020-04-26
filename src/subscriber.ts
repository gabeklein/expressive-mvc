import { useEffect, useState } from 'react';

import { ensureReady } from './bootstrap';
import { Callback, LifeCycle, ModelController } from './types';
import { componentLifecycle } from './use_hook';
import { dedent, define, Set, callIfExists as ifExists } from './util';

export type UpdateTrigger = Callback;

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const UNSUBSCRIBE = Symbol("add_subscription");
export const SUBSCRIBE = Symbol("end_subscription");

export const useManualRefresh = () => {
  const [ state, update ] = useState({} as any);
  const refresh = () => update(Object.assign({}, state));
  return [ state, refresh ] as const;
}

function subscriberLifecycle(control: ModelController){
  return {
    willCycle: control.elementWillCycle || control.willCycle,
    willRender: control.elementWillRender || control.willRender,
    willUpdate: control.elementWillUpdate || control.willUpdate,
    willUnmount: control.elementWillUnmount || control.willUnmount,
    didMount: control.elementDidMount || control.didMount,
    willMount: control.elementWillMount || control.willMount
  }
}

export function useSubscriber(
  control: ModelController, 
  args: any[], 
  main: boolean){

  const [ cache, onShouldUpdate ] = useManualRefresh();
  let event: LifeCycle = cache[LIFECYCLE];

  const willDeallocate = ensureReady(control);

  if(!cache.current){
    event = cache[LIFECYCLE] = main ? 
      componentLifecycle(control) : 
      subscriberLifecycle(control);

    control = cache.current = 
      createSubscription(control, onShouldUpdate) as any;

    ifExists(event.willMount, control, args);
  }
  else {
    const current = Object.getPrototypeOf(cache.current);

    if(control !== current)
      instanceIsUnexpected(control, current);

    ifExists(event.willUpdate, control, args);
  }

  ifExists(event.willRender, control, args);

  useEffect(() => {
    let onEOL = ifExists(event.willCycle, control, args);

    ifExists(event.didMount, control, args);

    control[SUBSCRIBE]!();

    return () => {
      ifExists(willDeallocate);
      ifExists(event.willUnmount, control, args);
      ifExists(onEOL);

      control[UNSUBSCRIBE]!();
    };
  }, [])

  return cache.current;
}

function instanceIsUnexpected(
  control: ModelController, cached: ModelController){

  const ControlType = cached.constructor;

  if(control instanceof ControlType)
    console.warn(dedent`
      Unexpected Instance:
      use() received unexpected instance of ${ControlType.name}!
      This should not change between renders of the same component. 
      Force a remount instead using key props.
    `)
  else
    throw new Error(dedent`
      Unexpected Controller:
      use() received unexpected controller between renders!
      Expected ${ControlType.name} and got ${control.constructor.name}!
      This should never happen; force a remount where a passed controller may change.
    `)
}

//TODO: Turn this into a class like Dispatch
export function createSubscription(
  source: ModelController,
  onUpdate: UpdateTrigger
): ModelController {

  const Spy = Object.create(source);
  const dispatch = source.dispatch!;
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