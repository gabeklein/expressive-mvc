import React, { useMemo } from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { suspend } from '../suspense';
import { use } from './use';
import { useFrom } from './useFrom';
import { useLocal } from './useLocal';

declare namespace useTap {
  type SourceType<T extends Model> = {
    new(): T;
    get?(): T
  }

  type Source<T extends Model> =
    | T
    | SourceType<T>
    | Model.Type<T>
    | (() => T | Model.Type<T>);
}

function useTap <T extends Model> (
  source: useTap.Source<T>
  ): T;

function useTap <T extends Model, K extends Model.Field<T>> (
  source: useTap.Source<T>,
  path: K,
  expect: true
): Exclude<T[K], undefined>;

function useTap <T extends Model, K extends Model.Field<T>> (
  source: useTap.Source<T>,
  path: K,
  expect?: boolean
): T[K];

function useTap <T extends Model, R> (
  source: useTap.Source<T>,
  compute: (this: T, from: T) => R,
  expect: true
): Exclude<R, undefined>;

function useTap <T extends Model, R> (
  source: useTap.Source<T>,
  compute: (this: T, from: T) => R,
  expect?: boolean
): R;

function useTap <T extends Model> (
  source: useTap.Source<T>,
  path?: Model.Field<T> | ((this: T, from: T) => any),
  expect?: boolean) {

  const instance = useMemo(() => {
    if(typeof source == "object")
      return () => source;

    if("get" in source)
      return () => source.get!();

    return "prototype" in source ?
      () => useLocal(source as Model.Type<T>)
      : source;
  }, [])() as T;

  if(typeof path == "function")
    return useFrom(instance, path, expect);

  const local = use(refresh => (
    Control.for(instance).subscribe(() => refresh)
  ));

  React.useLayoutEffect(local.commit, []);
  
  if(typeof path !== "undefined"){
    const value = local.proxy[path];

    if(value === undefined && expect)
      throw suspend(Control.for(instance), path);

    return value;
  }

  return local.proxy;
}

export { useTap }