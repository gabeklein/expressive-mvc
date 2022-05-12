import React, { useState } from 'react';

import { control } from '../controller';
import { Model, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { Class, InstanceOf } from '../types';
import { use } from './hooks';

function useModel <T extends Stateful> (
  source: (() => T) | T,
  watch?: Model.Field<T>[],
  callback?: (instance: T) => void
): T;

function useModel <T extends Stateful> (
  source: (() => T) | T,
  callback?: (instance: T) => void
): T;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  watch: Model.Field<I>[],
  callback?: (instance: I) => void
): I;

function useModel <T extends Class, I extends InstanceOf<T>> (
  source: T,
  callback?: (instance: I) => void
): I;

function useModel <T extends Model | Stateful> (
  source: any,
  arg?: ((instance: T) => void) | Model.Event<T>[],
  callback?: ((instance: T) => void)) {

  const instance = React.useMemo(() => {
    const cb = callback || arg;
    const instance: T =
      typeof source == "function" ?
        source.prototype instanceof Model ?
          new source() :
          source() : 
        source;

    control(instance);

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
  
    return instance
  }
  else {
    const local = use(refresh => {
      return new Subscriber(instance, () => refresh);
    });
  
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
}

export { useModel }