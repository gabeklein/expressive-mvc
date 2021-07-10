import { useLayoutEffect, useMemo, useState } from 'react';

import { Stateful } from './controller';
import { issues } from './issues';
import { Event, forAlias, Lifecycle as Cycle } from './lifecycle';
import { Model } from './model';
import { usePeers } from './peer';
import { Subscriber } from './subscriber';
import { fn } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

const subscriberEvent = forAlias("element");
const componentEvent = forAlias("component");

class HookSubscriber extends Subscriber {
  alias = subscriberEvent;
  isMounted = false;

  constructor(
    subject: any,
    callback: Callback,
    protected tag?: Key){

    super(subject, callback);
  }

  at(name: Event){
    const also = this.alias(name);

    for(const key of [name, also]){
      const on: any = this.subject;
      const handle = on[key];
  
      handle && handle.call(on, this.tag);
      this.parent.update(key);
    }
  }

  useLifecycle(){
    this.at(Cycle.WILL_RENDER);
    this.at(this.isMounted
      ? Cycle.WILL_UPDATE
      : Cycle.WILL_MOUNT  
    )

    useLayoutEffect(() => {
      this.listen();
      this.isMounted = true;
      this.at(Cycle.DID_MOUNT);

      return () => {
        this.at(Cycle.WILL_UNMOUNT);
        this.release();
      }
    })
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

    this.watch(key, () => {
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

  useLayoutEffect(() => () => instance.destroy(), []);

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

  useLayoutEffect(hook.listen, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = useRefresh(trigger => {
    const key = fn(tag) ? tag(target) : tag || 0;

    return new HookSubscriber(target, trigger, key)  
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
    const sub = new ComponentSubscriber(instance, trigger);

    if(callback)
      callback(instance);

    return sub;
  });

  usePeers(hook.subject);
  hook.useLifecycle();

  return hook.proxy;
}