import React, { useState } from 'react';

import { Model, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { Class, InstanceOf } from '../types';
import { use } from './hooks';

function useModel <T extends Stateful> (
  source: (() => T) | T,
  watch?: Model.Field<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Stateful> (
  source: (() => T) | T,
  callback?: (instance: T) => void
): T;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  watch: Model.Field<I>[],
  callback?: (instance: I) => void
): I;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  callback?: (instance: I) => void
): I;

function useModel(
  source: (new () => Model) | Stateful,
  arg?: ((instance: Stateful) => void) | string[],
  callback?: ((instance: Stateful) => void)) {

  const instance = React.useMemo(() => {
    const cb = callback || arg;
    const instance = typeof source == "function" ?
      new source() : source;

    if(typeof cb == "function")
      cb(instance);

    return instance;
  }, []);

  if(Array.isArray(arg)){
    const update = useState(0)[1];
  
    React.useLayoutEffect(() => {  
      if(arg.length && instance instanceof Model)
        instance.on(arg, () => update(x => x+1), true);

      return () => {
        if(Model.isTypeof(source) && instance instanceof source)
          instance.destroy();
      }
    }, []);
  
    return instance
  }
  else {
    const local = use(refresh => {
      return new Subscriber(instance, () => refresh);
    });
  
    React.useLayoutEffect(() => {
      local.commit();
  
      return () => {
        local.release();
  
        if(Model.isTypeof(source) && instance instanceof source)
          instance.destroy();
      };
    }, []);
  
    return local.proxy;
  }
}

export { useModel }