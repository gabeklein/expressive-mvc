import React, { useState } from 'react';

import { Controller } from '../controller';
import { Model } from '../model';
import { Class, InstanceOf } from '../types';
import { getOwnPropertyNames } from '../util';
import { use } from './use';

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  watch: Model.Field<I>[],
  callback?: (instance: I) => void
): I;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  callback?: (instance: I) => void
): I;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  apply: Model.Compat<I>,
  keys?: Model.Event<I>[]
): I;

function useModel <T extends Model> (
  source: (() => T) | T,
  watch?: Model.Field<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: (() => T) | T,
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: (() => T) | T,
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useModel <T extends Model> (
  source: any,
  arg?: ((instance: T) => void) | Model.Event<T>[] | Model.Compat<T>,
  arg2?: ((instance: T) => void) | Model.Field<T>[]){

  const instance = React.useMemo(() => {
    const cb = arg2 || arg;
    const instance: T =
      typeof source == "function" ?
        source.prototype instanceof Model ?
          new source() :
          source() : 
        source;

    Controller.has(instance);

    if(typeof cb == "function")
      cb(instance);

    return instance;
  }, []);

  if(Array.isArray(arg)){
    const update = useState(0)[1];

    React.useLayoutEffect(() => {  
      if(arg.length && instance instanceof Model)
        instance.on(arg, () => update(x => x+1), true);

      return () => {
        if(Model.isTypeof(source))
          (instance as Model).destroy();
      }
    }, []);

    return instance;
  }
  
  const local = use(refresh => (
    Controller.has(instance).subscribe(() => refresh)
  ));

  if(typeof arg == "object"){
    local.active = false;

    if(typeof arg2 !== "object")
      arg2 = getOwnPropertyNames(instance) as Model.Field<T>[];

    for(const key of arg2)
      if(key in arg)
        (instance as any)[key] = arg[key];

    React.useLayoutEffect(() => {
      local.active = true;
    });
  }

  React.useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();

      if(Model.isTypeof(source))
        (instance as Model).destroy();
    };
  }, []);

  return local.proxy;
}

export { useModel }