import React, { useMemo } from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { suspend } from '../suspense';
import { useContext } from './context';
import { MVC } from './mvc';
import { use } from './use';
import { useValue } from './useValue';

declare namespace useTap {
  type Source<T extends Model> =
    | T
    | Model.Type<T>
    | (() => T | Model.Type<T>);
}

function useTap <T extends Model> (source: useTap.Source<T>): T;

function useTap <T extends Model, K extends Model.Field<T>> (source: useTap.Source<T>, path: K, expect: true): Exclude<T[K], undefined>;
function useTap <T extends Model, K extends Model.Field<T>> (source: useTap.Source<T>, path: K, expect?: boolean): T[K];

function useTap <T extends Model, R> (source: useTap.Source<T>, connect: (this: T, model: T) => () => R): R;
function useTap <T extends Model, R> (source: useTap.Source<T>, connect: (this: T, model: T) => (() => R) | null): R | null;

function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => Promise<R> | R, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => Promise<R>, expect?: boolean): R | undefined;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => R, expect?: boolean): R;

function useTap <T extends Model> (
  source: typeof Model | typeof MVC | (() => any),
  arg1?: Model.Field<T> | ((this: T, from: T) => any),
  arg2?: boolean) {

  const instance: T = useMemo(() => {
    if(typeof source == "object")
      return () => source;

    if(Model.isTypeof(source))
      return "get" in source
        ? () => source.get()
        : () => useContext(source);

    return source;
  }, [])();

  if(typeof arg1 == "function")
    return useValue(instance, arg1, arg2);

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