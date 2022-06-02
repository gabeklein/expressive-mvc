import React, { useLayoutEffect } from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { Lookup } from '../register';

import type { Callback, InstanceOf } from '../types';

export const LookupContext = React.createContext(new Lookup());
export const useLookup = () => React.useContext(LookupContext);

export const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

function useLocal <T extends typeof Model> (Type: T, required: false): InstanceOf<T> | undefined;
function useLocal <T extends typeof Model> (Type: T, arg?: boolean): InstanceOf<T>;
function useLocal <T extends typeof Model, I extends InstanceOf<T>> (Type: T, effect: (found: I) => Callback | void): I;
function useLocal <T extends typeof Model, I extends InstanceOf<T>, K extends Model.Field<I>> (Type: T, key: K): I[K];

function useLocal<T extends typeof Model>(
  Type: T, arg?: boolean | string | ((found: InstanceOf<T>) => Callback | void)) {

  const instance = useLookup().get(Type);

  if(!instance && arg !== false)
    throw Oops.NotFound(Type.name);

  switch(typeof arg){
    case "string":
      return (instance as any)[arg];

    case "function":
      useLayoutEffect(() => arg(instance), []);

    default:
      return instance;
  }
}

export { useLocal }