import React, { useState } from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { usePeerContext } from './tap';
import { use } from './use';

function useNew <T extends Model> (
  source: Model.Type<T> | (() => T),
  callback?: (instance: T) => void
): T;

function useNew <T extends Model> (
  source: Model.Type<T> | (() => T),
  watch: Model.Key<T>[],
  callback?: (instance: T) => void
): T;

function useNew <T extends Model> (
  source: Model.Type<T> | (() => T),
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useNew <T extends Model> (
  source: (() => T) | Model.Type<T>,
  arg1?: ((i: T) => void) | Model.Event<T>[] | Model.Compat<T>,
  arg2?: ((i: T) => void) | Model.Key<T>[]){

  const instance = React.useMemo(() => {
    const callback = arg2 || arg1;
    const instance = Model.isTypeof(source)
      ? new source() as T
      : source();

    Control.for(instance);

    if(typeof callback == "function")
      callback(instance);

    return instance;
  }, []);

  usePeerContext(instance);

  if(Array.isArray(arg1)){
    const update = useState(0)[1];

    React.useLayoutEffect(() => {  
      if(arg1.length && instance instanceof Model)
        instance.on(arg1, () => update(x => x+1));

      return () => {
        if(Model.isTypeof(source))
          (instance as Model).end();
      }
    }, []);

    return instance;
  }
  
  const local = use(refresh => (
    Control.for(instance).subscribe(() => refresh)
  ));

  if(typeof arg1 == "object")
    local.assign(arg1, arg2);

  React.useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();

      if(Model.isTypeof(source))
        (instance as Model).end();
    };
  }, []);

  return local.proxy;
}

export { useNew }