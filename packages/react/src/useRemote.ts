import { Model, effect } from '@expressive/mvc';

import { useContext, useEffect, useState } from './useContext';

export function useRemote<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Model.get.Factory<T, any>
){
  const context = useContext();
  const state = useState(() => {
    const refresh = () => state[1](x => x.bind(null));
    let output: (() => R) | undefined | null;

    function forceUpdate(): void;
    function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
      if(typeof action == "function")
        action = action();

      refresh();

      if(action)
        return action.finally(refresh);
    }

    context.get(this, instance => {
      if(!instance)
        if(argument === false)
          return;
        else
          throw new Error(`Could not find ${this} in context.`);
  
      let release: (() => void) | undefined;
      let value: any;
  
      release = effect(instance, current => {
        if(typeof argument === "function"){
          const next = argument.call(current, current, forceUpdate);
  
          if(next === value)
            return;
  
          value = next;
        }
        else
          value = current;
  
        if(release)
          refresh();
      }, argument === true);
  
      if(value === null){
        release();
        output = null;
      }
      else if(value instanceof Promise){
        let error: Error | undefined;
  
        release();
  
        // TODO: ignore update if resolves to undefined or null
        value.then(x => value = x).catch(e => error = e).finally(refresh);
        value = null;
  
        output = () => {
          if(error)
            throw error;
  
          return value === undefined ? null : value;
        }
      }
      else
        output = () => {
          useEffect(() => release, []);
          return value === undefined ? null : value;
        }
    });

    return () => output && output();
  });

  return state[0]() as R;
}