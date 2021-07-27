import { useLayoutEffect, useMemo, useState } from 'react';

import { issues } from './issues';
import { Lifecycle, lifecycle } from './lifecycle';
import { CONTROL, Model, Stateful } from './model';
import { usePeers } from './peer';
import { Subscriber } from './subscriber';
import { defineProperty, fn, name } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

const useElementLifecycle = lifecycle("element");
const useComponentLifecycle = lifecycle("component");

function use<T>(init: (trigger: Callback) => T){
  const [ state, forceUpdate ] = useState((): T[] => [
    init(() => forceUpdate(state.concat()))
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
    fn(select) ?
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
    const sub = new Subscriber(target[CONTROL], refresh);

    if(focus){
      const [ key ] = sub.parent.keys(focus);
      const { proxy } = sub;
  
      defineProperty(sub, "proxy", {
        get(){
          if(expected && proxy[key] === undefined)
            throw Oops.HasPropertyUndefined(name(target), key);
  
          return proxy[key];
        }
      })}

    return sub;
  });

  useLayoutEffect(hook.commit, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = use(refresh => {
    return new Subscriber(target[CONTROL], refresh);
  });

  useElementLifecycle(hook, tag || 0);
  
  return hook.proxy;
}

export function useModel(
  Type: Class,
  args: any[], 
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type(...args) as Model;
    const sub = new Subscriber(instance[CONTROL], refresh);

    if(callback)
      callback(instance);

    instance.on(
      Lifecycle.WILL_UNMOUNT, 
      () => instance.destroy()
    );

    return sub;
  });

  usePeers(hook.parent.subject as Model);
  useComponentLifecycle(hook);

  return hook.proxy;
}