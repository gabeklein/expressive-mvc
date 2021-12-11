import { useLayoutEffect, useMemo, useState } from 'react';

import { keys, manage, Stateful } from './controller';
import { issues } from './issues';
import { Lifecycle } from './lifecycle';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { defineProperty } from './util';

export const Oops = issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
})

export function use<T>(init: (trigger: Callback) => T){
  const [ state, update ] = useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

export function useLazy<T extends typeof Model>(
  Type: T, callback?: (instance: InstanceOf<T>) => void){

  const instance = useMemo(() => {
    const instance = Type.create();

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

export function useModel(
  Type: Class,
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type() as Model;
    const control = manage(instance);
    const sub = new Subscriber(control, refresh);

    const release = control.addListener({
      [Lifecycle.WILL_UNMOUNT](){
        instance.destroy();
        release();
      }
    });

    if(callback)
      callback(instance);

    return sub;
  });

  return hook.proxy;
}