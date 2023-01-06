import React, { useState } from 'react';

import { Control } from '../control';
import { Model } from '../model';
import { usePeerContext } from './tap';
import { use } from './use';

function useModel <T extends Model> (
  source: Model.Type<T>,
  watch: Model.Field<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: Model.Type<T>,
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: Model.Type<T>,
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useModel <T extends Model> (
  source: () => T,
  watch?: Model.Field<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: () => T,
  callback?: (instance: T) => void
): T;

function useModel <T extends Model> (
  source: () => T,
  apply: Model.Compat<T>,
  keys?: Model.Event<T>[]
): T;

function useModel <T extends Model> (
  source: (() => T) | Model.Type<T>,
  arg?: ((i: T) => void) | Model.Event<T>[] | Model.Compat<T>,
  arg2?: ((i: T) => void) | Model.Field<T>[]){

  const instance = React.useMemo(() => {
    const callback = arg2 || arg;
    const instance =
      Model.isTypeof(source) ?
        source.new() :
        source();

    Control.for(instance);

    if(typeof callback == "function")
      callback(instance);

    return instance;
  }, []);

  usePeerContext(instance);

  if(Array.isArray(arg)){
    const update = useState(0)[1];

    React.useLayoutEffect(() => {  
      if(arg.length && instance instanceof Model)
        instance.on(arg, () => update(x => x+1));

      return () => {
        if(Model.isTypeof(source))
          (instance as Model).kill();
      }
    }, []);

    return instance;
  }
  
  const local = use(refresh => (
    Control.for(instance).subscribe(() => refresh)
  ));

  if(typeof arg == "object")
    local.assign(arg, arg2);

  React.useLayoutEffect(() => {
    local.commit();

    return () => {
      local.release();

      if(Model.isTypeof(source))
        (instance as Model).kill();
    };
  }, []);

  return local.proxy;
}

export { useModel }