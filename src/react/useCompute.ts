import React from 'react';

import { control } from '../control';
import { defineProperty, uid } from '../helper/object';
import { MVC } from './mvc';
import { use } from './use';

import type { Callback, NoVoid } from '../helper/types';
import { Subscriber } from '../subscriber';

function useCompute <T extends {}, R extends []> (
  source: (() => T) | T,
  compute: (this: T, from: T, update: MVC.ForceUpdate) => R
): R;

function useCompute <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T, update: MVC.ForceUpdate) => R,
  expect: true
): Exclude<R, undefined>;

function useCompute <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T, update: MVC.ForceUpdate) => R,
  expect?: boolean
): NoVoid<R>;

function useCompute <T extends {}, R> (
  source: {},
  compute: (this: T, from: T, update: MVC.ForceUpdate) => R | undefined,
  suspend?: boolean) {

  const deps = [uid(source)];
  const local = use(refresh => {
    const sub = new Subscriber(control(source), () => update);
    const spy = sub.proxy as T;

    let make: (() => R | undefined) | undefined =
      () => compute.call(spy, spy, forceUpdate)

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
      compute = () => get();
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

        if(suspend)
          throw new Promise<void>(res => retry = res);

        return null;
      }
    });

    return sub;
  }, deps);

  if(!local)
    return null;

  React.useLayoutEffect(() => local.release, deps);

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

export { useCompute }
