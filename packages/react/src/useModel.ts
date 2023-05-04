import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { Pending, useLookup } from './context';

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
    const proxy = Control.watch(instance, () => onUpdate);
    const refresh = () => state[1](x => x+1);

    let onUpdate: (() => void) | undefined | null;
    let applyPeers: undefined | boolean;
    let applyProps = typeof arg1 === "object";

    function commit(){
      onUpdate = refresh;
      return () => {
        onUpdate = null;
        instance.null();
      }
    }

    if(typeof arg1 == "function")
      arg1(instance);

    return (props: Model.Compat<T>) => {
      if(applyPeers)
        useLookup();

      else if(applyPeers !== false){
        const pending = Pending.get(instance);
      
        if(applyPeers = !!pending){
          const local = useLookup();

          pending.forEach(init => init(local));
          Pending.delete(instance);
        }
      }

      if(applyProps){
        onUpdate = undefined;
        applyProps = !!arg2;

        for(const key in props)
          if(instance.hasOwnProperty(key))
            (instance as any)[key] = (props as any)[key];
    
        instance.on(0).then(() => onUpdate = refresh);
      }

      useLayoutEffect(commit, []);

      return proxy;
    };
  }, []);

  return render(arg1 as Model.Compat<T>);
}

export { useModel }