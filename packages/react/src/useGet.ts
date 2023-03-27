import { Model, Subscriber } from '@expressive/mvc';
import React from 'react';

import { uid } from './helper/object';
import { Callback, NoVoid } from './helper/types';

function useGet <T extends Model> (this: Model.Class<T>): T;

function useGet <T extends Model> (this: Model.Class<T>, passive: true): T;
function useGet <T extends Model> (this: Model.Class<T>, required: false): T | undefined;

function useGet <T extends Model, R> (this: Model.Class<T>, init: Model.GetCallback<T, () => R>): NoVoid<R>;
function useGet <T extends Model, R> (this: Model.Class<T>, init: Model.GetCallback<T, (() => R) | null>): NoVoid<R> | null;

function useGet <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useGet <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useGet <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, R>, expect?: boolean): NoVoid<R>;

function useGet <T extends Model> (
  this: Model.Class<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean) {

  const instance = this.find(arg1 !== false) as T;
      
  if(typeof arg1 == "boolean")
    return instance;

  return useSubscriber(instance, arg1, arg2);
}

function useSubscriber<T extends Model, R>(
  source: T,
  callback?: Model.GetCallback<T, any>,
  required?: boolean){

  const deps = [uid(source)];
  const state = React.useState(0);
  const local = React.useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);

    if(!callback)
      return new Subscriber(source, () => refresh);

    const sub = new Subscriber(source, () => update);
    const spy = sub.proxy as T;

    let compute: (() => R | undefined) | undefined =
      () => callback!.call(spy, spy, forceUpdate)

    function forceUpdate(): void;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)): Promise<any>;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(compute)
        reassign(compute());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    function reassign(next: any){
      value = next;

      if(retry) {
        retry();
        retry = undefined;
      }
      else
        refresh();
    };

    let retry: Callback | undefined;
    let update: Callback | undefined;
    let value = compute();

    if(value === null){
      sub.watch.clear();
      compute = undefined;
      return;
    }

    if(typeof value == "function"){
      const get = value;

      sub.watch.clear();
      callback = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      value.then(reassign);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => {
        const next = compute!();

        if(notEqual(value, next))
          reassign(next);
      };
    }

    Object.defineProperty(sub, "proxy", {
      get() {
        if(value !== undefined)
          return value;

        if(required)
          throw new Promise<void>(res => retry = res);

        return null;
      }
    });

    return sub;
  }, deps);

  if(!local)
    return null;

  React.useLayoutEffect(() => {
    local.commit();
    return () => local.release();
  }, deps);

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

export { useGet }