import React from 'react';

import { control } from '../control';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { usePeerContext } from './get';

function useModel <T extends Model> (
  source: Model.New<T> | (() => T),
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: Model.New<T> | (() => T),
  watch: Model.Key<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: Model.New<T> | (() => T),
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useModel <T extends Model> (
  source: (() => T) | Model.New<T>,
  arg1?: ((i: T) => void) | Model.Event<T>[] | Model.Compat<T>,
  arg2?: ((i: T) => void) | Model.Key<T>[]){

  const instance = React.useMemo(() => {
    const callback = arg2 || arg1;
    const instance = Model.isTypeof(source)
      ? new source()
      : source();

    control(instance);

    if(typeof callback == "function")
      callback(instance);

    return instance;
  }, []);

  usePeerContext(instance);

  if(Array.isArray(arg1)){
    const update = React.useState(0)[1];

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

  const state = React.useState(0);
  const local = React.useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);
    return new Subscriber(control(instance), () => refresh);
  }, []);

  if(typeof arg1 == "object")
    local.apply(arg1, arg2 as Model.Key<T>[]);

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

export { useModel }