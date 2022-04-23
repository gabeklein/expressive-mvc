import React from 'react';

import { Model, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { defineProperty } from '../util';
import { use } from './hooks';

export function useModel(
  source: (new () => Model) | (() => Stateful) | Stateful,
  arg?: string | ((instance: Stateful) => void) | {},
  expected?: boolean) {

  const local = use(refresh => {
    const instance = typeof source == "function" ?
      "prototype" in source ?
        new (source as any)() as Model :
        (source as any)() :
      source;

    const sub = new Subscriber(instance, () => refresh);

    if (typeof arg === "function")
      arg(instance);

    else if (typeof arg == "string") {
      const source = sub.proxy;

      defineProperty(sub, "proxy", {
        get() {
          const value = source[arg];

          if (value === undefined && expected)
            throw suspend(sub.parent, arg);

          return value;
        }
      });
    }

    return sub;
  });

  React.useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();

      if (local.source !== source)
        local.source.destroy();
    };
  }, []);

  return local.proxy;
}
