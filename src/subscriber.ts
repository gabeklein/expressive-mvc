import { useEffect, useRef, useState } from 'react';

import { ensureBootstrap } from './bootstrap';
import { Callback, ModelController, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';
import { componentLifecycle } from './use_hook';
import { dedent, define, Set } from './util';

const { create, defineProperty } = Object;

export type UpdateTrigger = Callback;

export const useRefresh = (): UpdateTrigger => {
  const updateHook = useState(0)[1];
  return () => updateHook(Math.random());
}

function subscriberLifecycle(control: ModelController){
  return {
    willExist: control.elementWillExist || control.willExist,
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
    
  const onDidUpdate = useRefresh();
  const cache = useRef<any>(null);
  let endLifecycle: undefined | Callback

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount,
    willExist
  } = main ? 
    componentLifecycle(control) : 
    subscriberLifecycle(control);

  const willDeallocate = ensureBootstrap(control);

  if(!cache.current){
    const spy = createSubscription(control, onDidUpdate);

    if(willMount)
      willMount.apply(control, args);

    cache.current = control;
    control = spy as any;
  }
  else {
    if(control !== cache.current)
      controllerIsUnexpected(control, cache.current);

    if(willUpdate)
      willUpdate.apply(control, args);
  }

  if(willRender)
    willRender.apply(control, args)

  useEffect(() => {
    const spy = control as unknown as SpyController;

    spy[SUBSCRIBE]();

    if(willExist)
      endLifecycle = willExist.apply(control, args);

    if(didMount)
      didMount.apply(control, args);

    return () => {
      if(willDeallocate)
        willDeallocate();
      
      if(endLifecycle)
        endLifecycle()

      if(willUnmount)
        willUnmount.apply(control, args);

      spy[UNSUBSCRIBE]()
    };
  }, [])

  return control;
}

function controllerIsUnexpected(
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
): SpyController {

  const Spy = create(source);
  const { dispatch } = source;
  const { current, refresh } = dispatch!;
  const cleanup = new Set<Callback>();
  const watch = new Set<string>();
  let exclude: Set<string>;

  for(const key in current)
    defineProperty(Spy, key, {
      set: (value: any) => {
        current[key] = value;
        refresh(key);
      },
      get: () => {
        watch.add(key);
        return current[key];
      }
    })

  define(Spy, SUBSCRIBE, subscribe);
  define(Spy, UNSUBSCRIBE, unsubscribe);
  define(Spy, {
    once: () => source,
    on: alsoWatchValues,
    only: onlySubscribeTo,
    not: dontWatchValues
  })

  return Spy;

  function subscribe(){
    if(exclude)
      for(const k of exclude)
        watch.delete(k);

    for(const key of watch)
      cleanup.add(
        dispatch!.addListener(key, onUpdate)
      )
  }

  function unsubscribe(){
    for(const unsub of cleanup)
      unsub()
  }

  function onlySubscribeTo(...keys: string[]){
    const watch = new Set<string>();

    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    for(const key of watch)
      cleanup.add(
        dispatch!.addListener(key, onUpdate)
      )

    return source;
  }

  function dontWatchValues(...keys: string[]){
    exclude = new Set<string>();

    for(let arg of keys)
      for(const key of arg.split(","))
        exclude.add(key);
        
    return Spy;
  }

  function alsoWatchValues(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    return Spy;
  }
}