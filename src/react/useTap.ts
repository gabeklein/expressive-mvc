import React from 'react';

import { control } from '../control';
import { uid } from '../helper/object';
import { NoVoid } from '../helper/types';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { useContext } from './context';
import { MVC } from './mvc';
import { use } from './use';
import { useCompute } from './useCompute';

declare namespace useTap {
  type Source<T extends Model> =
    | T
    | Model.Type<T>
    | (() => T | Model.Type<T>);

  type Callback<T extends Model, R> =
    (this: T, model: T, update: MVC.ForceUpdate) => R;
}

function useTap <T extends Model> (source: useTap.Source<T>): T;

function useTap <T extends Model> (source: useTap.Source<T>, expect: true): { [P in Model.Key<T>]: Exclude<T[P], undefined> };
function useTap <T extends Model> (source: useTap.Source<T>, expect?: boolean): { [P in Model.Key<T>]: T[P] | undefined };

function useTap <T extends Model, R> (source: useTap.Source<T>, connect: useTap.Callback<T, () => R>): NoVoid<R>;
function useTap <T extends Model, R> (source: useTap.Source<T>, connect: useTap.Callback<T, (() => R) | null>): NoVoid<R> | null;

function useTap <T extends Model, R> (source: useTap.Source<T>, compute: useTap.Callback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: useTap.Callback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useTap <T extends Model, R> (source: useTap.Source<T>, compute: useTap.Callback<T, R>, expect?: boolean): NoVoid<R>;

function useTap <T extends Model> (
  source: T | typeof Model | typeof MVC,
  arg1?: boolean | useTap.Callback<T, any>,
  arg2?: boolean) {

  const instance: T =
    typeof source == "object"
      ? source
      : "get" in source
        ? source.get() as T
        : useContext(source) as T;

  return typeof arg1 == "function"
    ? useCompute(instance, arg1, arg2)
    : useSubscribe(instance, arg1);
}

function useSubscribe <T extends {}> (source: T, expect: true): { [P in Model.Key<T>]: Exclude<T[P], undefined> };
function useSubscribe <T extends {}> (source: T, expect?: boolean): T;

function useSubscribe(source: any, expect?: boolean){
  const deps = [uid(source)];
  const local = use(refresh => (
    new Subscriber(control(source), () => refresh, expect)
  ), deps);

  React.useLayoutEffect(() => local.commit(), deps);

  return local.proxy;
}

export { useTap, useSubscribe }