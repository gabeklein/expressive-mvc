import { useLayoutEffect, useMemo, useState } from 'react';

import { issues } from './issues';
import { Lifecycle, lifecycle } from './lifecycle';
import { manage, Model, Stateful } from './model';
import { usePeers } from './peer';
import { Subscriber } from './subscriber';
import { defineProperty, name } from './util';

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

export function useLazy(
  Type: typeof Model, args: any[]){

  const instance = useMemo(() => Type.create(...args), []);

  useLayoutEffect(() => () => instance.destroy(), []);

  return instance;
}

export function usePassive<T extends typeof Model>(
  target: T, select?: boolean | string | Select){

  const instance: any = target.find(!!select);

  return (
    typeof select == "function" ?
      select(instance) :
    typeof select == "string" ?
      instance[select] :
      instance
  )
}

export function useWatcher(
  target: Stateful,
  focus?: string | Select,
  expected?: boolean){

  const hook = use(refresh => {
    const sub = new Subscriber(manage(target), refresh);

    if(focus){
      const [ key ] = sub.parent.keys(focus);
      const { proxy } = sub;

      defineProperty(sub, "proxy", {
        get(){
          if(proxy[key] === undefined && expected)
            throw Oops.HasPropertyUndefined(name(target), key);

          return proxy[key];
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
    new Subscriber(manage(target), refresh)
  );

  useElementLifecycle(hook, tag || 0);
  
  return hook.proxy;
}

export function useModel(
  Type: Class,
  args: any[], 
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type(...args) as Model;
    const sub = new Subscriber(manage(instance), refresh);

    instance.on(Lifecycle.WILL_UNMOUNT, () => {
      instance.destroy();
    });

    if(callback)
      callback(instance);

    return sub;
  });

  usePeers(hook.parent.subject as Model);
  useComponentLifecycle(hook);

  return hook.proxy;
}