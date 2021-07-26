import { useLayoutEffect, useMemo, useState } from 'react';

import { issues } from './issues';
import { Event, forAlias, Lifecycle as Component } from './lifecycle';
import { CONTROL, Model, Stateful } from './model';
import { usePeers } from './peer';
import { Subscriber } from './subscriber';
import { defineProperty, fn, name } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class Hook extends Subscriber {
  alias!: (from: Event) => Event;
  tag?: Key;

  constructor(
    public subject: any,
    callback: Callback
  ){
    super(subject[CONTROL], callback);
  }

  at(name: Event){
    for(const key of [name, this.alias(name)]){
      const handle = this.subject[key];
  
      if(handle)
        handle.call(this.subject, this.tag);

      this.parent.update(key);
    }
  }

  focus(key: string | Select, expect?: boolean){
    const { proxy, subject } = this;

    if(fn(key)){
      const available: BunchOf<string> = {};

      for(const key in subject)
        available[key] = key;

      key = key(available);
    }

    defineProperty(this, "proxy", {
      get(){
        const value = proxy[key as string];

        if(expect && value === undefined)
          throw Oops.HasPropertyUndefined(
            name(subject), key as string
          );

        return value;
      }
    })
  }
}

function useManaged<T>(
  init: (trigger: Callback) => T){

  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

function useLifecycle(sub: Hook){
  sub.at(Component.WILL_RENDER);
  sub.at(sub.active
    ? Component.WILL_UPDATE
    : Component.WILL_MOUNT  
  )

  useLayoutEffect(() => {
    sub.commit();
    sub.at(Component.DID_MOUNT);

    return () => {
      sub.at(Component.WILL_UNMOUNT);
      sub.release();
    }
  })
}

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useLayoutEffect(() => () => instance.destroy(), []);

  return instance;
}

export function usePassive<T extends typeof Model>(
  target: T,
  select?: boolean | string | Select){

  const instance = target.find(!!select);

  return (
    fn(select) ? select(instance) :
    typeof select == "string" ? (instance as any)[select] :
    instance
  )
}

export function useWatcher(
  target: Stateful,
  path?: string | Select,
  expected?: boolean){

  const hook = useManaged(update => {
    const sub = new Hook(target, update);

    if(path)
      sub.focus(path, expected);

    return sub;
  });

  useLayoutEffect(hook.commit, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = useManaged(update => {
    const sub = new Hook(target, update);

    sub.alias = subscriberEvent;
    sub.tag = fn(tag) ? tag(target) : tag || 0;

    return sub;
  });

  useLifecycle(hook);
  
  return hook.proxy;
}

export function useModel(
  Type: typeof Model,
  args: any[], 
  callback?: (instance: Model) => void){

  const hook = useManaged(update => {
    const instance = Type.create(...args);
    const sub = new Hook(instance, update);

    sub.alias = componentEvent;

    if(callback)
      callback(instance);

    instance.on(
      Component.WILL_UNMOUNT, 
      () => instance.destroy()
    );

    return sub;
  });

  usePeers(hook.subject);
  useLifecycle(hook);

  return hook.proxy;
}