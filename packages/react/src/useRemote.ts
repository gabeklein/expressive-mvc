import { Model } from '@expressive/mvc';
import { useContext, useEffect, useMemo, useState } from 'react';

import { Shared } from './useLocal';

export function useRemote<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Model.GetFactory<T, any>
){
  const context = useContext(Shared)
  const state = useState(0);
  const hook = useMemo(() => {
    const instance = context.get(this);
    const refresh = () => state[1](x => x+1);

    let value: any;
    let release: Callback | undefined;

    if(!instance)
      if(argument !== false)
        throw new Error(`Could not find ${this} in context.`);
      else
        return undefined;

    if(typeof argument === "boolean")
      return () => instance;

    function forceUpdate(): void;
    function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
      if(typeof action == "function")
        action = action();

      refresh();

      if(action)
        return action.finally(refresh);
    }

    release = instance.get(current => {
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
    });

    if(value === null){
      release();
      return () => null;
    }

    if(value instanceof Promise){
      let error: Error | undefined;

      release();

      // TODO: ignore update if resolves to undefined or null
      value.then(x => value = x).catch(e => error = e).finally(refresh);
      value = null;

      return () => {
        if(error)
          throw error;

        return value === undefined ? null : value;
      }
    }

    return () => {
      useEffect(() => release, []);
      return value === undefined ? null : value;
    }
  }, []);

  return hook && hook();
}