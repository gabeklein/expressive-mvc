import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { usePeerContext } from './useContext';

function useModel <T extends Model> (
  this: Model.New<T>,
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  this: Model.New<T>,
  apply: Model.Compat<T>,
  repeat?: boolean
): T;

function useModel <T extends Model> (
  this: Model.New<T>,
  arg1?: Model.Compat<T> | ((i: T) => void),
  arg2?: boolean){

  const instance = useMemo(() => {
    const instance = new this();

    Control.for(instance);

    if(typeof arg1 == "function")
      arg1(instance);

    return instance;
  }, []);

  const state = useState(0);
  const local = useMemo(() => {
    const update = () => state[1](x => x+1);
    let refresh: (() => void) | undefined | null;

    const memo: {
      apply?: (from: Model.Compat<T>) => void;
      commit: () => () => void;
      proxy: T;
    } = {
      commit(){
        refresh = update;
        return () => {
          refresh = null;
          instance.null();
        }
      },
      proxy: Control.sub(instance, () => refresh)
    };

    if(typeof arg1 == "object")
      memo.apply = (values: Model.Compat<T>) => {
        refresh = undefined;

        if(!arg2)
          memo.apply = undefined;

        for(const key in values)
          if(instance.hasOwnProperty(key))
            (instance as any)[key] = (values as any)[key];

        instance.on(0).then(() => refresh = update);
      }

    return memo;
  }, []);

  usePeerContext(instance);

  if(local.apply)
    local.apply(arg1 as Model.Compat<T>);

  useLayoutEffect(local.commit, []);

  return local.proxy;
}

export { useModel }