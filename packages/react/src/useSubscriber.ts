import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useState } from 'react';

export function useSubscriber<T extends Model>(
  getInstance: (cb: (got: T) => void) => void){
    
  const state = useState(() => {
    let refresh: (() => void) | undefined;
    const next = () => state[1]({ commit, proxy });
    let proxy!: T;

    getInstance(got => {
      proxy = Control.sub(got, () => refresh);
    })

    const commit = () => {
      refresh = next;
      return () => refresh = undefined;
    }

    return { commit, proxy }
  });

  useLayoutEffect(state[0].commit, []);

  return state[0].proxy;
}

export function useComputed<T extends Model, R>(
  source: ((callback: (got: T) => void) => void),
  getter: Model.GetCallback<T, any>,
  required?: boolean){

  const [state, next] = useState(() => {
    let resolve: (() => void) | undefined;
    let update: (() => void) | undefined | null;
    let isFactory: true | undefined;
    let proxy!: T;

    let compute: (() => R | undefined) | undefined =
      () => getter.call(proxy, proxy, forceUpdate)

    source(got => {
      proxy = Control.sub(got, () => {
        return isFactory ? null : update;
      });
    });

    let refresh = () => next(subscribe);
    let value = compute();

    if(value === null){
      refresh = () => next({});
      compute = undefined;
      update = null;
      return {} as {
        commit?: React.EffectCallback;
        proxy?: R | null;
      };
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.sub(proxy, () => update)

      isFactory = true;
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

    return subscribe();

    function subscribe(){
      return {
        commit(){
          return () => {
            update = null;
          }
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
      }
    }

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
  });

  if(state.proxy === undefined)
    return null;

  if(state.commit)
    useLayoutEffect(state.commit, []);

  return state.proxy;
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