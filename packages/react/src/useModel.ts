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

  return useModelHook(arg1 as any, refresh => {
    let onUpdate: (() => void) | undefined | null;
    let applyPeers: undefined | boolean;
    let applyProps = typeof arg1 === "object";

    const instance = this.new();
    const proxy = Control.watch(instance, () => onUpdate);

    if(typeof arg1 == "function")
      arg1(instance);

    return {
      commit(){
        onUpdate = refresh;
        return () => {
          onUpdate = null;
          instance.null();
        }
      },
      render(props: Model.Compat<T>){
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

        return proxy;
      }
    }
  });
}

function useModelHook<T extends Model>(
  arg1: Model.Compat<T>,
  factory: (update: () => void) => {
    commit: () => (() => void) | void;
    render: (props: Model.Compat<T>) => T;
  }){

  const state = useState(0);
  const hook = useMemo(() => (
    factory(() => state[1](x => x+1))
  ), []);

  useLayoutEffect(hook.commit, []);

  return hook.render(arg1);
}

export { useModel }