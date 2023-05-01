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
    let refresh: (() => void) | undefined;
    let done: undefined | boolean;

    const update = () => state[1](x => x+1);

    const proxy = Control.sub(instance, () => {
      return done ? null : refresh
    });

    let didApply: undefined | boolean;

    function apply(values: Model.Compat<T>){
      if(arg2 || !didApply){
        didApply = true;
        refresh = undefined;

        for(const key in values)
          if(instance.hasOwnProperty(key))
            (instance as any)[key] = (values as any)[key];

        instance.on(0).then(() => refresh = update);
      }
    }

    function commit(){
      refresh = update;
      return () => {
        done = true;
        instance.null();
      }
    }

    return {
      apply,
      commit,
      proxy
    };
  }, []);

  usePeerContext(instance);

  if(typeof arg1 == "object")
    local.apply(arg1);

  useLayoutEffect(local.commit, []);

  return local.proxy;
}

export { useModel }