import { Model, Subscriber } from '@expressive/mvc';
import React from 'react';

import { uid } from './helper/object';
import { Callback, NoVoid } from './helper/types';

function useTap <T extends Model> (this: Model.Type<T>): T;

function useTap <T extends Model> (this: Model.Type<T>, passive: true): T;
function useTap <T extends Model> (this: Model.Type<T>, required: false): T | undefined;

function useTap <T extends Model, R> (this: Model.Type<T>, init: Model.TapCallback<T, () => R>): NoVoid<R>;
function useTap <T extends Model, R> (this: Model.Type<T>, init: Model.TapCallback<T, (() => R) | null>): NoVoid<R> | null;

function useTap <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useTap <T extends Model, R> (this: Model.Type<T>, compute: Model.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

function useTap <T extends Model> (
  this: Model.Type<T>,
  arg1?: boolean | Model.TapCallback<T, any>,
  arg2?: boolean) {

  const Type = this as unknown as typeof Model;
  const instance = Type.get(arg1 !== false) as T;
      
  if(typeof arg1 == "boolean")
    return instance;

  return useSubscriber(instance, arg1, arg2);
}

function useSubscriber<T extends Model, R>(
  source: T,
  callback?: Model.TapCallback<T, any>,
  required?: boolean){

  const deps = [uid(source)];
  const state = React.useState(0);
  const local = React.useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);

    if(!callback)
      return new Subscriber(source, () => refresh);
      
    const sub = new Subscriber(source, () => update);
    const spy = sub.proxy as T;

    let make: (() => R | undefined) | undefined =
      () => callback!.call(spy, spy, forceUpdate)

    function forceUpdate(): void;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)): Promise<any>;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(make)
        reassign(make());
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
    let value = make();

    if(value === null){
      sub.watch.clear();
      make = undefined;
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
        const next = make!();

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

export { useTap }