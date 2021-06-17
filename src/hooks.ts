import { useEffect, useMemo, useState } from 'react';

import { bindRefFunctions } from './bind';
import { useLookup } from './context';
import { Controllable } from './controller';
import { forAlias, Lifecycle, useLifecycleEffect } from './lifecycle';
import { Model } from './model';
import { PendingContext } from './modifiers';
import { Subscriber } from './subscriber';
import { defineLazy, fn, values } from './util';

import Oops from './issues';

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class ReactSubscriber<T extends Controllable> extends Subscriber<T> {
  constructor(subject: T, callback: Callback){
    super(subject, callback);

    defineLazy(this.proxy, "bind", () => {
      const agent = bindRefFunctions(this.parent);
      this.dependant.add(agent);
      return agent.proxy;
    });
  }

  public event(name: string, alias: string){
    for(const event of [alias, name]){
      const on: any = this.subject;
      const handle = on[event];

      handle && handle.call(on);
      this.parent.update(event);
    }
  }

  public focus(key: string, expect?: boolean){
    const source = this.subject as any;

    this.watch(key, () => {
      let value = source[key];

      if(value instanceof Model){
        const child = new Subscriber(value, this.callback);
        this.proxy = child.proxy as any;
        return child;
      }

      if(value === undefined && expect)
        throw Oops.HasPropertyUndefined(source.constructor.name, key);

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
  target: Controllable | (() => Controllable),
  path?: string | Select,
  expected?: boolean){

  const hook = useRefresh(trigger => {
    if(fn(target))
      target = target();

    if(fn(path)){
      const detect = {} as any;

      for(const key in target)
        detect[key] = key;

      path = path(detect) as string;
    }

    const sub = new ReactSubscriber(target, trigger);

    if(path)
      sub.focus(path, expected);

    return sub;
  });

  useEffect(() => hook.listen(), []);

  return hook.proxy;
}

export function useSubscriber(
  target: Model, args: any[]){

  const hook = useRefresh(trigger => 
    new ReactSubscriber(target, trigger)
  );

  useLifecycleEffect((name) => {
    if(name == Lifecycle.DID_MOUNT)
      hook.listen();

    hook.event(name, subscriberEvent(name));

    if(name == Lifecycle.WILL_UNMOUNT)
      hook.release();
  });
  
  return hook.proxy;
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);
  useEffect(() => () => instance.destroy(), []);
  return instance;
}

const ContextUsed = new WeakMap<Model, boolean>();

export function usePeerContext(instance: Model){
  if(ContextUsed.has(instance)){
    if(ContextUsed.get(instance))
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

  ContextUsed.set(instance, hasPeers);
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

    return new ReactSubscriber(instance, trigger);
  });

  usePeerContext(hook.subject);

  if(withLifecycle === false)
    useEffect(() => hook.listen(), []);
  else
    useLifecycleEffect((name) => {
      if(name == Lifecycle.DID_MOUNT)
        hook.listen();

      hook.event(name, componentEvent(name));

      if(name == Lifecycle.WILL_UNMOUNT){
        hook.release();
        hook.subject.destroy();
      }
    });

  return hook.proxy;
}