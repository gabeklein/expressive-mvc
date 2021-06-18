import { useEffect, useMemo, useState } from 'react';

import { bindRefFunctions } from './bind';
import { useLookup } from './context';
import { Event, forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Model, Stateful } from './model';
import { PendingContext } from './modifiers';
import { Subscriber } from './subscriber';
import { defineLazy, fn, values } from './util';

import Oops from './issues';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class HookSubscriber extends Subscriber {
  alias = subscriberEvent;
  isMounted = false;

  constructor(
    subject: Stateful,
    callback: Callback,
    bindable?: boolean){

    super(subject, callback);

    if(bindable !== false)
      defineLazy(this.proxy, "bind", () => {
        const agent = bindRefFunctions(this.parent);
        this.dependant.add(agent);
        return agent.proxy;
      });
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
  
      handle && handle.call(on);
      this.parent.update(key);
    }
  }
}

class ComponentSubscriber extends HookSubscriber {
  alias = componentEvent;
  
  release(){
    super.release();
    this.subject.destroy();
  }
}

class ElementSubscriber extends HookSubscriber {
  constructor(
    subject: Stateful,
    callback: Callback,
    key?: string,
    expect?: boolean){

    super(subject, callback, !key);

    if(key)
      this.bind(subject, key, expect);
  }

  bind(on: any, key: string, expect?: boolean){
    this.watch(key, () => {
      let value = on[key];

      if(value instanceof Model){
        const child = new Subscriber(value, this.callback);
        this.proxy = child.proxy as any;
        return child;
      }

      if(value === undefined && expect)
        throw Oops.HasPropertyUndefined(
          on.constructor.name, key
        );

      this.proxy = value;
    });
  }
}

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
  target: Stateful,
  path?: string | Select,
  expected?: boolean){

  const hook = useRefresh(trigger => {
    if(fn(path)){
      const detect = {} as any;

      for(const key in target)
        detect[key] = key;

      path = path(detect) as string;
    }

    return new ElementSubscriber(
      target, trigger, path, expected
    );
  });

  useEffect(hook.listen, []);

  return hook.proxy;
}

export function useSubscriber(target: Model){
  const hook = useRefresh(trigger => 
    new HookSubscriber(target, trigger)
  );

  useLifecycleEffect(hook.event);
  
  return hook.proxy;
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useEffect(() => () => instance.destroy(), []);

  return instance;
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

export function useModel(
  Type: typeof Model,
  args: any[], 
  callback?: (instance: Model) => void,
  withLifecycle?: boolean){

  const hook = useRefresh(trigger => {
    const instance = Type.create(...args);

    if(callback)
      callback(instance);

    return new ComponentSubscriber(instance, trigger);
  });

  usePeerContext(hook.subject);

  if(withLifecycle === false)
    useEffect(hook.listen, []);
  else
    useLifecycleEffect(hook.event);

  return hook.proxy;
}