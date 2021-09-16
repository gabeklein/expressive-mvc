import { useLayoutEffect, useMemo, useState } from 'react';

import { keys, Stateful } from './controller';
import { issues } from './issues';
import { Lifecycle, lifecycle } from './lifecycle';
import { Model } from './model';
import { usePeerContext } from './peer';
import { State } from './stateful';
import { Subscriber } from './subscriber';
import { defineProperty } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

const useElementLifecycle = lifecycle("element");
const useComponentLifecycle = lifecycle("component");

export function use<T>(init: (trigger: Callback) => T){
  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

export function useLazy<T extends typeof State>(
  Type: T, args?: any[], callback?: (instance: InstanceOf<T>) => void){

  const instance = useMemo(() => {
    const instance = Type.create(...args || []);

    if(callback)
      callback(instance);

    return instance;
  }, []);

  useLayoutEffect(() => () => instance.destroy(), []);

  return instance;
}

export function useWatcher(
  target: Stateful,
  focus?: string | Select,
  expected?: boolean){

  const hook = use(refresh => {
    const sub = new Subscriber(target, refresh);

    if(focus){
      const src = sub.proxy;
      const key = keys(sub.parent, focus)[0];

      defineProperty(sub, "proxy", {
        get(){
          if(src[key] === undefined && expected)
            throw Oops.HasPropertyUndefined(target, key);

          return src[key];
        }
      })
    }

    return sub;
  });

  useLayoutEffect(() => hook.commit(), []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = use(refresh =>
    new Subscriber(target, refresh)
  );

  useElementLifecycle(hook, tag || 0);
  
  return hook.proxy;
}

export function useModel(
  Type: Class,
  args?: any[], 
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type(...args || []) as Model;
    const sub = new Subscriber(instance, refresh);

    instance.on(Lifecycle.WILL_UNMOUNT, () => {
      instance.destroy();
    });

    if(callback)
      callback(instance);

    return sub;
  });

  usePeerContext(hook.parent.subject as Model);
  useComponentLifecycle(hook);

  return hook.proxy;
}