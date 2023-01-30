import React from 'react';

import { control } from '../control';
import { defineProperty } from '../helper/object';
import { use } from './use';

import type { Callback, NoVoid } from '../helper/types';

function useCompute <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect: true
): Exclude<R, undefined>;

function useCompute <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect?: boolean
): NoVoid<R>;

function useCompute(
  source: {},
  compute: Function,
  suspend?: boolean) {

  const local = use(refresh => {
    const sub = control(source).subscribe(() => update);
    const spy = sub.proxy;

    let value = compute.call(spy, spy);
    let update: Callback | undefined;
    let retry: Callback | undefined;

    const set = (next: any) => {
      value = next;

      if(retry) {
        retry();
        retry = undefined;
      }
      else
        refresh();
    };

    if(value === null){
      sub.watch.clear();
      return {
        proxy: null,
        release: () => {}
      }
    }

    if(typeof value == "function"){
      const get = value;

      sub.watch.clear();
      compute = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      value.then(set);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => {
        const next = compute.call(spy, spy);

        if(value != next)
          set(next);
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
  });

  React.useLayoutEffect(() => local.release, []);

  return local.proxy;
}

export { useCompute }
