import { useLayoutEffect, useMemo, useState } from 'react';

import { Stateful } from './controller';
import { issues } from './issues';
import { Event, forAlias, Lifecycle as Cycle } from './lifecycle';
import { Model } from './model';
import { usePeers } from './peer';
import { Subscriber } from './subscriber';
import { fn, defineProperty } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class Hook extends Subscriber {
  alias!: (from: Event) => Event;
  tag?: Key;

  at(name: Event){
    for(const key of [name, this.alias(name)]){
      const handle = this.subject[key];
  
      if(handle)
        handle.call(this.subject, this.tag);

      this.parent.update(key);
    }
  }

  useLifecycle(){
    this.at(Cycle.WILL_RENDER);
    this.at(this.active
      ? Cycle.WILL_UPDATE
      : Cycle.WILL_MOUNT  
    )

    useLayoutEffect(() => {
      this.listen();
      this.at(Cycle.DID_MOUNT);

      return () => {
        this.at(Cycle.WILL_UNMOUNT);
        this.release();
      }
    })
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
            subject.constructor.name, key as string
          );

        return value;
      }
    })
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

  const hook = useRefresh(trigger => {
    const sub = new Hook(target, trigger);

    if(path)
      sub.focus(path, expected);

    return sub;
  });

  useLayoutEffect(hook.listen, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = useRefresh(trigger => {
    const sub = new Hook(target, trigger);

    sub.alias = subscriberEvent;
    sub.tag = fn(tag) ? tag(target) : tag || 0;

    return sub;
  });

  hook.useLifecycle();
  
  return hook.proxy;
}

export function useModel(
  Type: typeof Model,
  args: any[], 
  callback?: (instance: Model) => void){

  const hook = useRefresh(trigger => {
    const instance = Type.create(...args);
    const sub = new Hook(instance, trigger);

    sub.alias = componentEvent;

    if(callback)
      callback(instance);

    instance.on("willUnmount", () => {
      instance.destroy();
    });

    return sub;
  });

  usePeers(hook.subject);
  hook.useLifecycle();

  return hook.proxy;
}