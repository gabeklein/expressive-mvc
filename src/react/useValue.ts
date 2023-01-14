import React from 'react';

import { Control } from '../control';
import { defineProperty } from '../object';
import { use } from './use';

import type { Callback } from '../types';

function useValue <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect: true
): Exclude<R, undefined>;

function useValue <T extends {}, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect?: boolean
): R;

function useValue(
  source: {},
  compute: Function,
  suspend?: boolean) {

  const local = use(refresh => {
    const sub = Control.for(source).subscribe(() => update);
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
        if(value === undefined && suspend)
          throw new Promise<void>(res => retry = res);

        return value;
      }
    });

    return sub;
  });

  React.useLayoutEffect(() => local.release, []);

  return local.proxy;
}

export { useValue }
