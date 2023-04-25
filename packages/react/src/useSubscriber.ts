import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useState } from 'react';

export function useSubscriber<T extends Model>(
  getInstance: (cb: (got: T) => void) => void){
    
  const state = useState(() => {
    const next = () => state[1]({ commit, proxy });
    let refresh: (() => void) | undefined;
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
  compute: Model.GetCallback<T, any>,
  required?: boolean){

  const [state, next] = useState(() => {
    let ready: (() => void) | undefined;
    let update: (() => void) | undefined | null;
    let value: R | undefined;

    let subscribe = (): {
      commit?: React.EffectCallback;
      proxy?: R | null;
    } => ({
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
            ready = res;
          });

        return null;
      }
    })

    let getValue: (() => R | undefined) | undefined;
    let refresh = () => next(subscribe);
    let factory: true | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.sub(got, () => factory ? null : update);
      getValue = () => compute.call(proxy, proxy, forceUpdate);
      value = getValue();
    });

    if(value === null){
      refresh = () => next({});
      subscribe = () => ({});
      getValue = undefined;
      update = null;
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.sub(proxy, () => update)

      factory = true;
      compute = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      update = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      update = () => {
        const next = getValue!();

        if(notEqual(value, next))
          didUpdate(next);
      };

    function didUpdate(next: any){
      value = next;

      if(ready) {
        ready();
        ready = undefined;
      }
      else
        refresh();
    };

    function forceUpdate(): void;
    function forceUpdate<T>(passthru: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(passthru?: Promise<T> | (() => Promise<T>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(getValue)
        didUpdate(getValue());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    return subscribe();
  });

  if(!state.commit)
    return null;

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