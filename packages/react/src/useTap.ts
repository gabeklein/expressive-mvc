import { Model, Subscriber } from '@expressive/mvc';
import React from 'react';

import { uid } from './helper/object';
import { Callback, NonOptionalValues, NoVoid, OptionalValues } from './helper/types';

function useTap <T extends Model> (source: T | Model.Type<T>): T;

function useTap <T extends Model> (source: T | Model.Type<T>, expect: true): NonOptionalValues<T>;
function useTap <T extends Model> (source: T | Model.Type<T>, expect?: boolean): OptionalValues<T>;

function useTap <T extends Model, R> (source: T | Model.Type<T>, init: Model.TapCallback<T, () => R>): NoVoid<R>;
function useTap <T extends Model, R> (source: T | Model.Type<T>, init: Model.TapCallback<T, (() => R) | null>): NoVoid<R> | null;

function useTap <T extends Model, R> (source: T | Model.Type<T>, compute: Model.TapCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (source: T | Model.Type<T>, compute: Model.TapCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useTap <T extends Model, R> (source: T | Model.Type<T>, compute: Model.TapCallback<T, R>, expect?: boolean): NoVoid<R>;

function useTap <T extends Model, R> (
  source: T | typeof Model,
  arg1?: boolean | Model.TapCallback<T, any>,
  arg2?: boolean) {

  const instance: T =
    typeof source == "object"
      ? source
      : source.get() as T;
      
  const deps = [uid(instance)];
  const state = React.useState(0);
  const local = React.useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);

    if(typeof arg1 != "function")
      return new TapSubscriber(instance, () => refresh, arg1)
      
    const sub = new Subscriber(instance, () => update);
    const spy = sub.proxy as T;

    let make: (() => R | undefined) | undefined =
      () => (arg1 as any).call(spy, spy, forceUpdate)

    function forceUpdate(): void;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)): Promise<any>;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(make)
        reassign(make());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    function reassign(next: any){
      value = next;

      if(retry) {
        retry();
        retry = undefined;
      }
      else
        refresh();
    };

    let retry: Callback | undefined;
    let update: Callback | undefined;
    let value = make();

    if(value === null){
      sub.watch.clear();
      make = undefined;
      return;
    }

    if(typeof value == "function"){
      const get = value;

      sub.watch.clear();
      arg1 = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      value.then(reassign);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => {
        const next = make!();

        if(notEqual(value, next))
          reassign(next);
      };
    }

    Object.defineProperty(sub, "proxy", {
      get() {
        if(value !== undefined)
          return value;

        if(arg2)
          throw new Promise<void>(res => retry = res);

        return null;
      }
    });

    return sub;
  }, deps);

  if(!local)
    return null;

  React.useLayoutEffect(() => {
    local.commit();
    return () => local.release();
  }, deps);

  return local.proxy;
}

class TapSubscriber<T extends Model> extends Subscriber<T> {
  constructor(
    parent: T,
    onUpdate: Subscriber.OnEvent<T>,
    protected strict: boolean | undefined){

    super(parent, onUpdate);
  }

  get(key: string, using?: Model.Subscriber.Getter<any> | undefined) {
    try {
      const value = super.get(key, using);
      
      if(value === undefined && this.strict === true)
        this.parent.waitFor(key);
        
      return value;
    }
    catch(err){
      if(err instanceof Promise && this.strict === false)
        return;

      throw err;
    }
  }
}

/** Values are not equal for purposes of a refresh. */
const notEqual = <T>(a: T, b: unknown) => (
  b !== a && (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.some((x, i) => x !== b[i])
  )
)

export { useTap }