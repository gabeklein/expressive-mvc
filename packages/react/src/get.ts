import { Control, Model } from '@expressive/mvc';
import { useEffect, useMemo, useState } from 'react';

import { useLookup } from './provider';

declare namespace get {
  /** Type may not be undefined - instead will be null.  */
  type NoVoid<T> = T extends undefined | void ? null : T;

  type Factory<T extends Model, R> = (this: T, current: T, update: ForceUpdate) => R;

  type ForceUpdate = {
    /** Force an update in current component. */
    (): void;
    
    /**
     * Force an update and again after promise either resolves or rejects.
     * Will return a duplicate of given Promise, which resolves after refresh.
     */
    <T = void>(passthru: Promise<T>): Promise<T>

    /**
     * Force a update while calling async function.
     * A refresh will occur both before and after given function.
     * Any actions performed before first `await` will occur before refresh!
     */
    <T = void>(invoke: () => Promise<T>): Promise<T>
  };
}

function get<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | get.Factory<T, any>
){
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => {
    const notFound = () => new Error(`Could not find ${this} in context.`);
    const refresh = () => state[1](x => x+1);
    let onUpdate: (() => void) | undefined | null;
    let value: any;

    if(typeof argument !== "function"){
      const got = context.get(this);

      if(got)
        value = argument === undefined
          ? Control.watch(got, k => k ? onUpdate : undefined)
          : got;
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

    const found = context.get(this);

    if(!found)
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

    proxy = Control.watch(found, () => factory ? null : onUpdate);
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

export { get }