import { useEffect, useRef, useState } from 'react';

import { Dispatch } from './dispatch';
import { ModelController, RENEW_CONSUMERS, SpyController, SUBSCRIBE, UNSUBSCRIBE, UpdateTrigger } from './types';
import { componentLifecycle, initializeController } from './use_hook';
import { dedent, define, Set } from './util';

const { create, defineProperty } = Object;

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
    
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);
  let endLifecycle: undefined | (() => void)

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount,
    willExist
  } = main ? 
    componentLifecycle(control) : 
    subscriberLifecycle(control)

  if(!cache.current){
    Dispatch.applyTo(control);
    
    const spy = createSubscription(control, setUpdate);

    initializeController(control)

    if(willMount)
      willMount.apply(control, args);

    cache.current = control;
    control = spy as any;
  }
  else {
    if(control !== cache.current){
      const ControlType = cache.current.constructor;

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

    const hookMaintenance = control[RENEW_CONSUMERS];

    if(hookMaintenance)
      hookMaintenance()

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
      if(endLifecycle)
        endLifecycle()

      if(willUnmount)
        willUnmount.apply(control, args);

      spy[UNSUBSCRIBE]()
    };
  }, [])

  return control;
}

export function createSubscription(
  source: ModelController,
  hook: UpdateTrigger
): SpyController {

  const Spy = create(source);
  const { dispatch } = source;
  const { current } = dispatch;
  const cleanup = new Set<() => void>();
  const watch = new Set<string>();
  let exclude: Set<string>;

  for(const key in current)
    defineProperty(Spy, key, {
      set: (value: any) => {
        current[key] = value;
        dispatch.refresh(key);
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
        dispatch.addListener(key, hook)
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
        dispatch.addListener(key, hook)
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