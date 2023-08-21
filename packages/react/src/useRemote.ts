import { Control, Model } from '@expressive/mvc';
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
    const notFound = () => new Error(`Could not find ${this} in context.`);

    let onUpdate: (() => void) | undefined | null;
    let value = instance as any;

    if(typeof argument !== "function"){
      let remove: Callback | undefined;

      if(instance){
        if(argument === undefined)
          remove = instance.get(current => {
            value = current;

            if(remove)
              refresh();
          })
      }
      else if(argument !== false)
        throw notFound();

      return () => {
        useEffect(() => remove, []);
        return value;
      }
    }

    let suspense: (() => void) | undefined;
    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    if(!instance)
      throw notFound();

    function forceUpdate(): void;
    function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
      if(typeof action == "function")
        action = action();

      if(getValue)
        didUpdate(getValue());
      else
        refresh();

      if(action)
        return action.finally(refresh);
    }

    function didUpdate(got: any){
      value = got;

      if(suspense){
        suspense();
        suspense = undefined;
      }
      else
        refresh();
    };

    proxy = Control.watch(instance, () => factory ? null : onUpdate);
    getValue = () => argument.call(proxy, proxy, forceUpdate);
    value = getValue();

    if(value === null){
      getValue = undefined;
      onUpdate = null;
      return null;
    }

    if(value instanceof Promise){
      onUpdate = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      onUpdate = () => {
        const next = getValue!();

        if(value !== next)
          didUpdate(next);
      };

    return () => {
      useEffect(() => () => {
        onUpdate = null;
      }, []);

      if(value !== undefined)
        return value;

      if(onUpdate)
        return null;

      throw new Promise<void>(res => suspense = res);  
    }
  }, []);

  return hook && hook();
}