import React from 'react';

import { Control } from '../control';
import { NoVoid } from '../helper/types';
import { Model } from '../model';
import { suspend } from '../suspense';
import { useContext } from './context';
import { MVC } from './mvc';
import { use } from './use';
import { useCompute } from './useCompute';

declare namespace useTap {
  type Source<T extends Model> =
    | T
    | Model.Type<T>
    | (() => T | Model.Type<T>);
}

function useTap <T extends Model> (source: useTap.Source<T>): T;

function useTap <T extends Model, K extends Model.Key<T>> (source: useTap.Source<T>, path: K, expect: true): Exclude<T[K], undefined>;
function useTap <T extends Model, K extends Model.Key<T>> (source: useTap.Source<T>, path: K, expect?: boolean): NoVoid<T[K]>;

function useTap <T extends Model, R> (source: useTap.Source<T>, connect: (this: T, model: T) => () => R): NoVoid<R>;
function useTap <T extends Model, R> (source: useTap.Source<T>, connect: (this: T, model: T) => (() => R) | null): NoVoid<R> | null;

function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => Promise<R> | R, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => Promise<R>, expect?: boolean): NoVoid<R> | null;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: (this: T, model: T) => R, expect?: boolean): NoVoid<R>;

function useTap <T extends Model> (
  source: T | typeof Model | typeof MVC,
  arg1?: Model.Key<T> | ((this: T, from: T) => any),
  arg2?: boolean) {

  const instance: T =
    typeof source == "object"
      ? source
      : "get" in source
        ? source.get() as T
        : useContext(source) as T;

  return typeof arg1 == "function"
    ? useCompute(instance, arg1, arg2)
    : useSubscribe(instance, arg1, arg2);
}

function useSubscribe <T extends {}, K extends Model.Key<T>> (source: T, path: K, expect: true): Exclude<T[K], undefined>;
function useSubscribe <T extends {}, K extends Model.Key<T>> (source: T, path?: K, expect?: boolean): NoVoid<T[K]>;

function useSubscribe(source: any, path?: string, expect?: boolean){
  const local = use(refresh => (
    Control.for(source).subscribe(() => refresh)
  ));

  React.useLayoutEffect(() => local.commit(), []);

  if(path === undefined)
    return local.proxy;

  const value = local.proxy[path];

  if(value === undefined && expect)
    throw suspend(local.parent, path);

  return value;
}

export { useTap, useSubscribe }