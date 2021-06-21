import { useEffect, useMemo, useState } from 'react';

import { useLookup } from './context';
import { Event, forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Model, Stateful } from './model';
import { PendingContext } from './instructions';
import { Subscriber } from './subscriber';
import { fn, values } from './util';

import Oops from './issues';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class HookSubscriber extends Subscriber {
  alias = subscriberEvent;
  isMounted = false;

  constructor(
    public subject: any,
    protected callback: Callback,
    protected tag?: Key){

    super(subject, callback);
  }

  event = (name: Event) => {
    this.declare(name);

    switch(name){
      case Lifecycle.WILL_RENDER:
        this.declare(
          this.isMounted
          ? Lifecycle.WILL_UPDATE
          : Lifecycle.WILL_MOUNT
        )
      break;

      case Lifecycle.DID_MOUNT:
        this.isMounted = true;
        this.listen();
      break;

      case Lifecycle.WILL_UNMOUNT:
        this.release();
    }
  }

  declare(name: Event){
    const also = this.alias(name);

    for(const key of [name, also]){
      const on: any = this.subject;
      const handle = on[key];
  
      handle && handle.call(on, this.tag);
      this.parent.update(key);
    }
  }
}

class ElementSubscriber extends HookSubscriber {
  focus(key: string | Select, expect?: boolean){
    const source = this.subject;

    if(fn(key)){
      const available = {} as BunchOf<string>;

      for(const key in source)
        available[key] = key;

      key = key(available);
    }

    this.recursive(key, () => {
      let value = source[key as string];

      if(value instanceof Model){
        const child = new Subscriber(value, this.callback);
        this.proxy = child.proxy as any;
        return child;
      }

      if(value === undefined && expect)
        throw Oops.HasPropertyUndefined(
          source.constructor.name, key as string
        );

      this.proxy = value;
    });
  }
}

class ComponentSubscriber extends HookSubscriber {
  alias = componentEvent;
  
  release(){
    super.release();
    this.subject.destroy();
  }
}

function useRefresh<T>(
  init: (trigger: Callback) => T){

  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useEffect(() => () => instance.destroy(), []);

  return instance;
}

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
  target: Stateful,
  path?: string | Select,
  expected?: boolean){

  const hook = useRefresh(trigger => {
    const sub = new ElementSubscriber(target, trigger);

    if(path)
      sub.focus(path, expected);

    return sub;
  });

  useEffect(hook.listen, []);

  return hook.proxy;
}

export type KeyFactory<T> = (target: T) => Key | undefined;

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = useRefresh(trigger => {
    const key = fn(tag) ? tag(target) : tag || 0;
    return new HookSubscriber(target, trigger, key)  
  });

  useLifecycleEffect(hook.event);
  
  return hook.proxy;
}

export function useModel(
  Type: typeof Model,
  args: any[], 
  callback?: (instance: Model) => void){

  const hook = useRefresh(trigger => {
    const instance = Type.create(...args);
    const sub = new ComponentSubscriber(instance, trigger);

    if(callback)
      callback(instance);

    return sub;
  });

  usePeerContext(hook.subject);
  useLifecycleEffect(hook.event);

  return hook.proxy;
}

const ContextWasUsed = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  if(ContextWasUsed.has(instance)){
    if(ContextWasUsed.get(instance))
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

  ContextWasUsed.set(instance, hasPeers);
}