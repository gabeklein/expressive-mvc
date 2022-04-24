import React from 'react';

import { Model, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { defineProperty } from '../util';
import { use } from './hooks';
import { useFrom } from './useFrom';

export function useTap <T extends Stateful> (
  source: (() => T) | T,
  path?: Model.Field<T> | Function,
  expect?: boolean) {

  if(typeof path == "function")
    return useFrom(source, path, expect);

  const local = use(refresh => {
    const instance =
      typeof source == "function" ?
        source() : source;

    const sub = new Subscriber(instance, () => refresh);

    if(typeof path == "string"){
      const source = sub.proxy;

      defineProperty(sub, "proxy", {
        get() {
          const value = source[path];

          if (value === undefined && expect)
            throw suspend(sub.parent, path);

          return value;
        }
      });
    }

    return sub;
  });

  React.useLayoutEffect(() => local.commit(), []);
  
  return local.proxy;
}