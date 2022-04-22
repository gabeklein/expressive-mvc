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
  model: (() => Stateful) | Stateful,
  path?: string | Function,
  expect?: boolean){

  return typeof path == "function"
    ? useFrom(model, path, expect)
    : useModel(model, path, expect);
}

export function useNew<T extends typeof Model>(
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

export function useFrom(
  target: (() => Stateful) | Stateful,
  compute: Function,
  suspend?: boolean){

  const local = use(refresh => {
    const instance =
      typeof target == "function" ? target() : target;

    const sub = new Subscriber(instance, () => update);
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

    defineProperty(sub, "proxy", {
      get(){
        if(value === undefined && suspend)
          throw new Promise<void>(res => retry = res);

        return value;
      }
    });

    return sub;
  });

  React.useLayoutEffect(() => local.release, []);

  return local.proxy;
}

export function useModel(
  source: (new () => Model) | (() => Stateful) | Stateful,
  arg?: string | ((instance: Stateful) => void) | {},
  expected?: boolean){

  const local = use(refresh => {
    const instance =
      typeof source == "function" ?
        "prototype" in source ?
          new (source as any)() as Model :
          (source as any)() :
        source;

    const sub = new Subscriber(instance, () => refresh);

    if(typeof arg === "function")
      arg(instance);

    else if(typeof arg == "string"){
      const source = sub.proxy;

      defineProperty(sub, "proxy", {
        get(){
          const value = source[arg];

          if(value === undefined && expected)
            throw suspend(sub.parent, arg)

          return value;
        }
      })
    }

    return sub;
  });

  React.useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();

      if(local.source !== source)
        local.source.destroy();
    }
  }, []);

  return local.proxy;
}