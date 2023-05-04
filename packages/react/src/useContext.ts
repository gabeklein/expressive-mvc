import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

export function useContext<T extends Model> (
  this: (typeof Model & Model.Type<T>),
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean){

  const factory = Control.fetch(this, arg1 !== false);

  if(typeof arg1 == "boolean"){
    let model!: T;
    factory($ => model = $);
    return model;
  }

  return arg1
    ? useComputed(factory, arg1, arg2)
    : useSubscriber(factory);
}

export function useSubscriber<T extends Model>(
  source: (callback: (got: T) => void) => void){

  const state = useState(0);
  const render = useMemo(() => {
    const refresh = () => state[1](x => x+1);
    let onUpdate: (() => void) | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.watch(got, () => onUpdate);
    })

    const commit = () => {
      onUpdate = refresh;
      return () => onUpdate = undefined;
    }

    return () => {
      useLayoutEffect(commit, []);
      return proxy;
    }
  }, []);

  return render();
}

export function useComputed<T extends Model, R>(
  source: ((callback: (got: T) => void) => void),
  compute: Model.GetCallback<T, any>,
  required?: boolean){

  const state = useState(0);
  const render = useMemo(() => {
    const refresh = () => state[1](x => x+1);
    let suspense: (() => void) | undefined;
    let onUpdate: (() => void) | undefined | null;
    let value: R | undefined;

    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.watch(got, () => factory ? null : onUpdate);
      getValue = () => compute.call(proxy, proxy, forceUpdate);
      value = getValue();

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
    });

    if(value === null){
      onUpdate = null;
      getValue = undefined;
      return () => null;
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.watch(proxy, () => onUpdate);

      factory = true;
      compute = () => get();
      value = get();
    }

    const didUpdate = (got: any) => {
      value = got;

      if(suspense){
        suspense();
        suspense = undefined;
      }
      else
        refresh();
    };

    if(value instanceof Promise){
      onUpdate = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      onUpdate = () => {
        const next = getValue!();

        if(notEqual(value, next))
          didUpdate(next);
      };

    const commit = () => () => {
      onUpdate = null;
    };

    return () => {
      useLayoutEffect(commit, []);

      if(value !== undefined)
        return value;

      if(required)
        throw new Promise<void>(res => {
          suspense = res;
        });

      return null;
    }
  }, []);

  return render();
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