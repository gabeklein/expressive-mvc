import React, { useMemo } from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { suspend } from '../suspense';
import { MVC } from './mvc';
import { use } from './use';
import { useContext } from './useContext';
import { useFrom } from './useFrom';

declare namespace useTap {
  type Source<T extends Model> =
    | T
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
  arg1?: Model.Field<T> | ((this: T, from: T) => any),
  arg2?: boolean) {

  const instance = useMemo(() => {
    if(typeof source == "object")
      return () => source;

    if(MVC.isTypeof(source))
      return () => source.get(true);

    if(Model.isTypeof(source))
      return () => useContext(source);

    return source;
  }, [])() as T;

  if(typeof arg1 == "function")
    return useFrom(instance, arg1, arg2);

  const local = use(refresh => (
    Control.for(instance).subscribe(() => refresh)
  ));

  React.useLayoutEffect(local.commit, []);

  if(arg1 === undefined)
    return local.proxy;

  const value = local.proxy[arg1];

  if(value === undefined && arg2)
    throw suspend(local.parent, arg1);

  return value;
}

export { useTap }