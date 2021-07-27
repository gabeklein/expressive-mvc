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

export class Hook extends Subscriber {
  constructor(
    public subject: any,
    callback: Callback
  ){
    super(subject[CONTROL], callback);
  }

  focus(key: string | Select, expect?: boolean){
    const { proxy, subject, parent } = this;
    const [ select ] = parent.keys(key);

    defineProperty(this, "proxy", {
      get(){
        const value = proxy[select];

        if(expect && value === undefined)
          throw Oops.HasPropertyUndefined(
            name(subject), select
          );

        return value;
      }
    })
  }
}

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
  path?: string | Select,
  expected?: boolean){

  const hook = use(refresh => {
    const sub = new Hook(target, refresh);

    if(path)
      sub.focus(path, expected);

    return sub;
  });

  useLayoutEffect(hook.commit, []);

  return hook.proxy;
}

export function useSubscriber<T extends Stateful>(
  target: T, tag?: Key | KeyFactory<T>){

  const hook = use(refresh => {
    return new Hook(target, refresh);
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
    const sub = new Hook(instance, refresh);

    if(callback)
      callback(instance);

    instance.on(
      Lifecycle.WILL_UNMOUNT, 
      () => instance.destroy()
    );

    return sub;
  });

  usePeers(hook.subject);
  useComponentLifecycle(hook);

  return hook.proxy;
}