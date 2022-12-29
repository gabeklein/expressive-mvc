import React, { useMemo } from 'react';

import { ensure } from '../controller';
import { Model, Stateful } from '../model';
import { suspend } from '../suspense';
import { use } from './use';
import { useFrom } from './useFrom';
import { useLocal } from './useLocal';

namespace useTap {
  export interface Tappable {
    new (): Stateful;
    new (...args: any[]): Stateful;
    get?: () => Stateful;
  }
}

function useTap <T extends Stateful> (source: T | (() => T)): T;

function useTap <T extends Stateful, K extends Model.Field<T>> (
  source: T | (() => T) | useTap.Tappable,
  path: K,
  expect: true
): Exclude<T[K], undefined>;

function useTap <T extends Stateful, K extends Model.Field<T>> (
  source: T | (() => T) | useTap.Tappable,
  path: K,
  expect?: boolean
): T[K];

function useTap <T extends Stateful, R> (
  source: T | (() => T) | useTap.Tappable,
  compute: (this: T, from: T) => R,
  expect: true
): Exclude<R, undefined>;

function useTap <T extends Stateful, R> (
  source: T | (() => T) | useTap.Tappable,
  compute: (this: T, from: T) => R,
  expect?: boolean
): R;

function useTap <T extends Stateful> (
  source: T | (() => T) | useTap.Tappable,
  path?: Model.Field<T> | ((this: T, from: T) => any),
  expect?: boolean) {

  const instance = useMemo(() => {
    if(typeof source == "object")
      return () => source;

    if("get" in source)
      return () => source.get!();

    return "prototype" in source ?
      () => useLocal(source as typeof Model)
      : source;
  }, [])() as T;

  if(typeof path == "function")
    return useFrom(instance, path, expect);

  const local = use(refresh => (
    ensure(instance).subscribe(() => refresh)
  ));

  React.useLayoutEffect(local.commit, []);
  
  if(typeof path !== "undefined"){
    const value = local.proxy[path];

    if(value === undefined && expect)
      throw suspend(ensure(instance), path);

    return value;
  }

  return local.proxy;
}

export { useTap }