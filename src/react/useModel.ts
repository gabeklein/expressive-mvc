import React from 'react';

import { Model, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { use } from './hooks';

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  callback?: (instance: I) => void
): I;

function useModel <T extends Stateful> (
  source: (() => T) | T,
  callback?: (instance: T) => void
): T;

function useModel(
  source: (new () => Model) | (() => Stateful) | Stateful,
  callback?: (instance: Stateful) => void) {

  const local = use(refresh => {
    const instance =
      typeof source == "function" ?
        "prototype" in source ?
          new (source as any)() :
          (source as any)() :
        source;

    const sub = new Subscriber(instance, () => refresh);

    if (typeof callback == "function")
      callback(instance);

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

export { useModel }