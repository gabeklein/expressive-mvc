import React from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { Lookup } from './context';

import { Callback } from '../types';

export const LookupContext = React.createContext(new Lookup());
export const useLookup = () => React.useContext(LookupContext);

export const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

function useLocal <T extends Model> (Type: Model.Type<T>, required: false):T | undefined;
function useLocal <T extends Model> (Type: Model.Type<T>, arg?: boolean):T;
function useLocal <T extends Model> (Type: Model.Type<T>, effect: (found: T) => Callback | void): T;
function useLocal <T extends Model, K extends Model.Field<T>> (Type: Model.Type<T>, key: K): T[K];

function useLocal<T extends Model>(
  Type: Model.Type<T>,
  arg?: boolean | string | ((found: T) => Callback | void)) {

  const instance = useLookup().get(Type);

  if(!instance && arg !== false)
    throw Oops.NotFound(Type.name);

  switch(typeof arg){
    case "string":
      return (instance as any)[arg];

    case "function":
      React.useLayoutEffect(() => arg(instance), []);

    default:
      return instance;
  }
}

export { useLocal }