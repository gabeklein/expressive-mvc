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

  const [state, update] = useState(() => {
    let suspense: (() => void) | undefined;
    let refresh: (() => void) | undefined | null;
    let value: R | undefined;

    let next = (): {
      commit?: React.EffectCallback;
      proxy?: R | null;
    } => ({
      commit(){
        return () => {
          refresh = null;
        }
      },
      get proxy(){
        if(value !== undefined)
          return value;

        if(required)
          throw new Promise<void>(res => {
            suspense = res;
          });

        return null;
      }
    })

    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.sub(got, () => factory ? null : refresh);
      getValue = () => compute.call(proxy, proxy, forceUpdate);
      value = getValue();
    });

    if(value === null){
      next = () => ({});
      getValue = undefined;
      refresh = null;
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.sub(proxy, () => refresh)

      factory = true;
      compute = () => get();
      value = get();
    }

    if(value instanceof Promise){
      refresh = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      refresh = () => {
        const next = getValue!();

        if(notEqual(value, next))
          didUpdate(next);
      };

    function didUpdate(got: any){
      value = got;

      if(suspense){
        suspense();
        suspense = undefined;
      }
      else
        update(next);
    };

    function forceUpdate(): void;
    function forceUpdate<T>(passthru: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(passthru?: Promise<T> | (() => Promise<T>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(getValue)
        didUpdate(getValue());
      else
        update(next);

      if(passthru)
        return passthru.finally(() => update(next));
    }

    return next();
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