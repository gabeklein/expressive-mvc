import { Control, Model } from '@expressive/mvc';
import { useEffect, useMemo, useState } from 'react';

import { useModelContext } from './useLocal';

export function useRemote<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Model.get.Factory<T, any>
){
  const context = useModelContext();
  const state = useState(0);
  const hook = useMemo(() => {
    const instance = context.get(this);
    const refresh = () => state[1](x => x+1);
    const notFound = () => new Error(`Could not find ${this} in context.`);

    let onUpdate: (() => void) | undefined | null;
    let value: any;

    if(typeof argument !== "function"){
      if(instance)
        value = argument === undefined
          ? Control.watch(instance, k => k ? onUpdate : undefined)
          : instance;
      else if(argument !== false)
        throw notFound();

      return () => {
        useEffect(() => {
          onUpdate = refresh;
          return () => {
            onUpdate = null;
          };
        }, []);

        return value;
      }
    }

    let compute = argument;
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
    getValue = () => compute.call(proxy, proxy, forceUpdate);
    value = getValue();

    if(value === null){
      getValue = undefined;
      onUpdate = null;
      return;
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.watch(proxy, () => onUpdate);

      factory = true;
      compute = () => get();
      value = get();
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

  return hook ? hook() : null;
}