import { useLayoutEffect, useMemo, useState } from 'react';

import { manage, Stateful } from './controller';
import { Lifecycle } from './lifecycle';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { suspend } from './suspense';
import { defineProperty } from './util';

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
  focus?: string,
  expected?: boolean){

  const hook = use(refresh => {
    const sub = new Subscriber(target, () => refresh);

    if(focus){
      const source = sub.proxy;

      defineProperty(sub, "proxy", {
        get(){
          const value = source[focus];

          if(value === undefined && expected)
            throw suspend(sub.parent, focus)

          return value;
        }
      })
    }

    return sub;
  });

  useLayoutEffect(() => hook.commit(), []);

  return hook.proxy;
}

export function useComputed(
  target: Stateful,
  compute: Function,
  expected?: boolean){

  const hook = use(refresh => {
    const sub = new Subscriber(target, () => update);
    const spy = sub.proxy;

    let value = compute.call(spy, spy);
    let update: RequestCallback | undefined;
    let retry: Callback | undefined;

    const set = (next: any) => {
      if(value == next)
        return;

      value = next;

      if(retry){
        retry();
        retry = undefined;
      }
      else
        refresh();
    }

    if(value instanceof Promise){
      value.then(set);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => set(
        compute.call(spy, spy)
      );
    }

    const get = expected
      ? () => {
        if(value === undefined)
          throw new Promise<void>(res => retry = res);

        return value;
      }
      : () => value

    defineProperty(sub, "proxy", { get });

    return sub;
  });

  useLayoutEffect(() => hook.release, []);

  return hook.proxy;
}

export function useModel(
  Type: Class,
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type() as Model;
    const control = manage(instance);
    const sub = new Subscriber(control, () => refresh);

    const release = control.addListener(
      (key: string) => {
        if(key == Lifecycle.WILL_UNMOUNT)
          return () => {
            instance.destroy();
            release();
          }
      }
    );

    if(callback)
      callback(instance);

    return sub;
  });

  return hook.proxy;
}