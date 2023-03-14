import React from 'react';

import { control } from '../control';
import { defineProperty, uid } from '../helper/object';
import { Callback, NonOptionalValues, NoVoid, OptionalValues } from '../helper/types';
import { Subscriber } from '../subscriber';
import { Model } from './mvc';

declare namespace useTap {
  type Source<T extends Model> =
    | T
    | Model.Type<T>
    | (() => T | Model.Type<T>);
}

function useTap <T extends Model> (source: useTap.Source<T>): T;

function useTap <T extends Model> (source: useTap.Source<T>, expect: true): NonOptionalValues<T>;
function useTap <T extends Model> (source: useTap.Source<T>, expect?: boolean): OptionalValues<T>;

function useTap <T extends Model, R> (source: useTap.Source<T>, init: Model.TapCallback<T, () => R>): NoVoid<R>;
function useTap <T extends Model, R> (source: useTap.Source<T>, init: Model.TapCallback<T, (() => R) | null>): NoVoid<R> | null;

function useTap <T extends Model, R> (source: useTap.Source<T>, compute: Model.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: Model.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: Model.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

function useTap <T extends Model, R> (
  source: T | (() => T) | typeof Model,
  arg1?: boolean | Model.TapCallback<T, any>,
  arg2?: boolean) {

  const instance: T =
    typeof source == "object"
      ? source
      : "get" in source
        ? source.get() as T
        : source();
      
  const deps = [uid(instance)];
  const state = React.useState(0);
  const local = React.useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);
    const controller = control(instance);
    
    if(typeof arg1 != "function")
      return new Subscriber(controller, () => refresh, arg1)
      
    const sub = new Subscriber(controller, () => update);
    const spy = sub.proxy as T;

    let make: (() => R | undefined) | undefined =
      () => (arg1 as any).call(spy, spy, forceUpdate)

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
      arg1 = () => get();
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

    defineProperty(sub, "proxy", {
      get() {
        if(value !== undefined)
          return value;

        if(arg2)
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