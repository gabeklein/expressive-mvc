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

  addRefs(){
    defineLazy(this.proxy, "bind", () => {
      const agent = bindRefFunctions(this.parent);
      this.dependant.add(agent);
      return agent.proxy;
    });
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
  focus(select: string | Select, expect?: boolean){
    const source = this.subject;

    if(fn(select)){
      const keys = {} as BunchOf<string>;

      for(const key in source)
        keys[key] = key;

      select = select(keys);
    }

    this.watch(select, () => {
      let value = source[select as string];

      if(value instanceof Model){
        const child = new Subscriber(value, this.callback);
        this.proxy = child.proxy as any;
        return child;
      }

      if(value === undefined && expect)
        throw Oops.HasPropertyUndefined(
          source.constructor.name, select as string
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
      sub.focus(path, expected)
    else
      sub.addRefs();

    return sub;
  });

  useEffect(hook.listen, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | ((target: T) => Key)){

  const hook = useRefresh(trigger => {
    const key = fn(tag) ? tag(target) : tag || 0;
    return new HookSubscriber(target, trigger, key)  
  });

  useLifecycleEffect(hook.event);
  
  return hook.proxy;
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useEffect(() => () => instance.destroy(), []);

  return instance;
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

    sub.addRefs();

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