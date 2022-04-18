import React from 'react';

import { Key, KeyFactory, Lifecycle, lifecycle } from './lifecycle';
import { Model, Stateful } from './model';
import { usePeerContext } from './peer';
import { Subscriber } from './subscriber';
import { suspend } from './suspense';
import { defineProperty } from './util';

const useElementLifecycle = lifecycle("element");
const useComponentLifecycle = lifecycle("component");

export function use<T>(init: (trigger: Callback) => T){
  const [ state, update ] = React.useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}

export function useTap(
  model: Model,
  path?: string | Function,
  expect?: boolean){

  if(typeof path == "function")
    return useComputed(model, path, expect);

  const proxy = useActive(model, path, expect);
  model.update("willRender", true);
  return proxy;
}

export function useTag<T extends Model>(
  model: T,
  id?: Key | KeyFactory<T>){

  const hook = use(refresh => (
    new Subscriber(model, () => refresh)
  ));

  useElementLifecycle(hook, id || 0);
  
  return hook.proxy;
}

export function useWithLifecycle<T extends Model>(
  model: T,
  callback?: (instance: T) => void){
    
  const hook = use(refresh => {
    if(callback)
      callback(model);

    return new Subscriber(model, () => refresh);
  });

  useComponentLifecycle(hook);
  
  return hook.proxy;
}

export function usePassive<T extends typeof Model>(
  Type: T, callback?: (instance: InstanceOf<T>) => void){

  const instance = React.useMemo(() => {
    const instance = Type.create();

    if(callback)
      callback(instance);

    return instance;
  }, []);

  React.useLayoutEffect(() => () => instance.destroy(), []);
  instance.update("willRender", true);

  return instance;
}

export function useActive(
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

  React.useLayoutEffect(() => hook.commit(), []);

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
      update = () => {
        const next = compute.call(spy, spy);

        if(value != next)
          set(next);
      }
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

  React.useLayoutEffect(() => hook.release, []);

  return hook.proxy;
}

export function useModel(
  Type: Class,
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance = new Type() as Model;
    const sub = new Subscriber(instance, () => refresh);
    const release = sub.parent.addListener(
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

  useComponentLifecycle(hook);
  usePeerContext(hook.source);

  return hook.proxy;
}