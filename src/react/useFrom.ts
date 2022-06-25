import React from 'react';

import { Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { defineProperty } from '../util';
import { use } from './use';

import type { Callback } from '../types';
import { ensure } from '../stateful';

function useFrom <T extends Stateful, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect: true
): Exclude<R, undefined>;

function useFrom <T extends Stateful, R> (
  source: (() => T) | T,
  compute: (this: T, from: T) => R,
  expect?: boolean
): R;

function useFrom(
  target: Stateful,
  compute: Function,
  suspend?: boolean) {

  const local = use(refresh => {
    const sub = new Subscriber(ensure(target), () => update);
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

export { useFrom }
