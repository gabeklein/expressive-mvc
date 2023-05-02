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

  const state = useState(0);
  const render = useMemo(() => {
    const instance = this.new();
    const proxy = Control.watch(instance, () => refresh);
    const update = () => state[1](x => x+1);
    const applyPeers = usePeerContext(instance);

    let refresh: (() => void) | undefined | null;
    let applyProps = typeof arg1 === "object";

    function commit(){
      refresh = update;
      return () => {
        refresh = null;
        instance.null();
      }
    }

    if(typeof arg1 == "function")
      arg1(instance);

    return (props: Model.Compat<T>) => {
      applyPeers();

      if(applyProps){
        refresh = undefined;
        applyProps = !!arg2;

        for(const key in props)
          if(instance.hasOwnProperty(key))
            (instance as any)[key] = (props as any)[key];
    
        instance.on(0).then(() => refresh = update);
      }

      useLayoutEffect(commit, []);

      return proxy;
    };
  }, []);

  return render(arg1 as Model.Compat<T>);
}

export { useModel }