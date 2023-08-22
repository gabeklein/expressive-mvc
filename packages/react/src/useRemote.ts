import { Model } from '@expressive/mvc';
import { useContext, useEffect, useMemo, useState } from 'react';

import { Shared } from './useLocal';

export function useRemote<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Model.get.Factory<T, any>
){
  const context = useContext(Shared)
  const state = useState(0);
  const hook = useMemo(() => {
    const instance = context.get(this);
    const refresh = () => state[1](x => x+1);

    let value: any;
    let remove: Callback | undefined;

    if(!instance)
      if(argument !== false)
        throw new Error(`Could not find ${this} in context.`);
      else
        return undefined;

    if(typeof argument !== "function"){
      if(argument !== undefined)
        return () => instance;

      remove = instance.get(current => {
        value = current;

        if(remove)
          refresh();
      })

      return () => {
        useEffect(() => remove, []);
        return value;
      }
    }

    function forceUpdate(): void;
    function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
      if(typeof action == "function")
        action = action();

      refresh();

      if(action)
        return action.finally(refresh);
    }

    remove = instance.get(current => {
      const next = argument.call(current, current, forceUpdate);

      if(next !== value){
        value = next;
        if(remove)
          refresh();
      }
    });

    if(value === null){
      remove();
      return () => null;
    }

    if(value instanceof Promise){
      let error: Error | undefined;

      remove();
      value.then(x => value = x).catch(e => error = e).finally(refresh);
      value = null;

      return () => {
        if(error)
          throw error;

        return value === undefined ? null : value;
      }
    }

    return () => {
      useEffect(() => remove, []);
      return value === undefined ? null : value;
    }
  }, []);

  return hook && hook();
}