import React from 'react';

import { Model, Stateful } from './model';
import { Subscriber } from './subscriber';
import { suspend } from './suspense';
import { defineProperty } from './util';

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

  return useActive(model, path, expect);
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
  source: Class | Model,
  callback?: (instance: Model) => void){

  const hook = use(refresh => {
    const instance =
      typeof source == "function" ?
        new source() as Model : source;

    const sub = new Subscriber(instance, () => refresh);

    if(callback)
      callback(instance);

    return sub;
  });

  React.useLayoutEffect(() => {
    hook.commit();

    return () => {
      hook.release();

      if(hook.source !== source)
        hook.source.destroy();
    }
  }, []);

  return hook.proxy;
}