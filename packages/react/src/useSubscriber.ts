import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

export function useSubscriber<T extends Model>(instance: T){
  const state = useState(0);
  const local = useMemo(() => {
    let refresh: (() => void) | undefined;
    const proxy = Control.sub(instance, () => refresh);

    return {
      proxy,
      commit(){
        refresh = state[1].bind(null, x => x+1);
        return () => refresh = undefined;
      }
    }
  }, [instance]);

  useLayoutEffect(local.commit, [instance]);

  return local.proxy;
}

export function useComputed<T extends Model, R>(
  instance: T,
  getter: Model.GetCallback<T, any>,
  required?: boolean){

  const state = useState(0);
  const local = useMemo(() => {
    let resolve: (() => void) | undefined;
    let update: (() => void) | undefined | null;
    let isFactory: true | undefined;

    const refresh = state[1].bind(null, x => x+1);
    const spy = Control.sub(instance, () => isFactory ? null : update);

    let compute: (() => R | undefined) | undefined =
      () => getter.call(spy, spy, forceUpdate)

    let value = compute();

    if(value === null){
      compute = undefined;
      update = null;
      return;
    }

    if(typeof value == "function"){
      const get = value;
      
      isFactory = true;
      Control.sub(spy, () => update)

      getter = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      update = null;
      value.then(didUpdate);
      value = undefined;
    }
    else {
      update = () => {
        const next = compute!();

        if(notEqual(value, next))
          didUpdate(next);
      };
    }

    return {
      commit: () => () => {
        update = null;
      },
      get proxy(){
        if(value !== undefined)
          return value;

        if(required)
          throw new Promise<void>(res => {
            resolve = res;
          });

        return null;
      }
    };

    function forceUpdate(): void;
    function forceUpdate<T>(passthru: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(passthru?: Promise<T> | (() => Promise<T>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(compute)
        didUpdate(compute());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    function didUpdate(next: any){
      value = next;

      if(resolve) {
        resolve();
        resolve = undefined;
      }
      else
        refresh();
    };
  }, [instance]);

  if(!local)
    return null;

  useLayoutEffect(local.commit, [instance]);

  return local.proxy;
}

/** Values are not equal for purposes of a refresh. */
const notEqual = <T>(a: T, b: unknown) => (
  b !== a && (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.some((x, i) => x !== b[i])
  )
)