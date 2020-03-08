import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { applyDispatch, DISPATCH, SOURCE } from './dispatch';
import { dedent, Set } from './polyfill';
import { ModelController, SpyController, UpdateTrigger } from './types';
import { componentLifecycle, ensureAttachedControllers, RENEW_CONSUMERS } from './use_hook';

export const UNSUBSCRIBE = "__delete_subscription__";
export const SUBSCRIBE = "__activate_subscription__";

const { create, defineProperty: define } = Object;

function ErrorUnexpectedController(got: any, expected: any){
  const ControlType = expected.constructor;
  if(got instanceof ControlType)
    return new Error(dedent`
      Unexpected Instance:
      use() received unexpected instance of ${ControlType.name}! 
      This should not change between renders of the same component. 
      Force a remount instead using key props.
    `)
  else
    return new Error(dedent`
      Unexpected Controller:
      use() received unexpected controller between renders!
      Expected ${ControlType.name} and got ${got.constructor.name}!
      This should never happen; force a remount where a passed controller may change.
    `)
}

function subscriberLifecycle(control: ModelController){
  return {
    willRender: control.elementWillRender || control.willRender,
    willUpdate: control.elementWillUpdate || control.willUpdate,
    willUnmount: control.elementWillUnmount || control.willUnmount,
    didMount: control.elementDidMount || control.didMount,
    willMount: control.elementWillMount || control.willMount
  }
}

export function useWatcher(control: ModelController){
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

  let { current } = cache;
  
  if(!current){
    applyDispatch(control);
    current = cache.current = createSubscription(control, setUpdate);
  }

  useEffect(() => {
    const listener = current as SpyController;
    listener[SUBSCRIBE]();
    return () => listener[UNSUBSCRIBE]();
  }, [])

  return current;
}

export function useWatchedProperty(
  parent: any, key: string, required?: boolean){

  const value = parent[key];

  if(value === undefined && required)
    throw new Error(`${parent.name}.${key} must be defined this render.`)

  const dispatch = parent[DISPATCH];
  const watchers = dispatch[key] || (dispatch[key] = new Set());
  const setRefresh = useState(0)[1];
  const subscription = useRef<SpyController | null>(null);

  function childDidUpdate(beat: number){
    setRefresh(beat);
  }

  function parentDidUpdate(beat: number){
    if(subscription.current)
      deallocate(subscription.current)

    setRefresh(beat);
  };

  function deallocate(subscriber: SpyController){
    const unfocus = 
      subscriber.elementWillLoseFocus || 
      subscriber.willLoseFocus;

    if(unfocus) 
      unfocus(parent, key);

    subscriber[UNSUBSCRIBE]();
    subscription.current = null;
  }

  useEffect(() => {
    watchers.add(parentDidUpdate);

    return () => {
      if(subscription.current)
        deallocate(subscription.current)

      watchers.delete(parentDidUpdate)
    }
  }, []);

  useEffect(() => {
    if(subscription.current)
      subscription.current[SUBSCRIBE]();
  }, [value])

  if(value instanceof Controller){
    const instance = value as ModelController;

    if(!subscription.current){
      applyDispatch(instance);
      ensureAttachedControllers(instance);

      const spy = createSubscription(instance, childDidUpdate);
      const didFocus = instance.elementDidFocus || instance.didFocus;

      if(didFocus)
        didFocus.call(instance, parent, key);

      subscription.current = spy;
      return spy;
    }
    else {
      if(instance[RENEW_CONSUMERS])
        instance[RENEW_CONSUMERS]!()

      return instance;
    }
  }
  else
    return value;
}

export function useSubscriber(
  control: ModelController, 
  args: any[], 
  main: boolean){
    
  const setUpdate = useState(0)[1];
  const cache = useRef<any>(null);

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount
  } = main 
    ? componentLifecycle(control) 
    : subscriberLifecycle(control)

  if(!cache.current){
    applyDispatch(control);
    
    const spy = createSubscription(control, setUpdate);

    ensureAttachedControllers(control)

    if(willMount)
      willMount.apply(control, args);

    cache.current = control;
    control = spy as any;
  }
  else if(control !== cache.current)
    throw ErrorUnexpectedController(control, cache.current);

  else {
    const consumers = control[RENEW_CONSUMERS];

    if(consumers)
      consumers()

    if(willUpdate)
      willUpdate.apply(control, args);
  }

  if(willRender)
    willRender.apply(control, args)

  useEffect(() => {
    const spy = control as unknown as SpyController;

    spy[SUBSCRIBE]();

    if(didMount)
      didMount.apply(control, args);

    return () => {
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

  const mutable = source[SOURCE];
  const register = source[DISPATCH];

  const Spy = create(source);

  let watch = new Set<string>();
  let exclude: Set<string>;

  for(const key in mutable)
    define(Spy, key, {
      set: (value: any) => mutable[key] = value,
      get: () => {
        watch.add(key);
        return mutable[key];
      }
    })

  define(Spy, SUBSCRIBE, { value: sub });
  define(Spy, UNSUBSCRIBE, { value: unSub });
  define(Spy, "once", { value: () => source });
  define(Spy, "on", { value: also });
  define(Spy, "only", { value: bail });
  define(Spy, "not", { value: except });

  return Spy;

  function sub(){
    if(exclude)
      for(const k of exclude)
        watch.delete(k);

    for(const key of watch){
      let set = register[key];
      if(!set)
        set = register[key] = new Set();
      set.add(hook);
    }
  }

  function unSub(){
    for(const key of watch)
      register[key].delete(hook);
  }

  function bail(...keys: string[]){
    const watch = new Set<string>();

    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    for(const key of watch)
      register[key].add(hook);

    return source;
  }

  function except(...keys: string[]){
    exclude = new Set<string>();

    for(let arg of keys)
      for(const key of arg.split(","))
        exclude.add(key);
        
    return Spy;
  }

  function also(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);

    return Spy;
  }
}