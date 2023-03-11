import React from 'react';

import { issues } from '../helper/issues';
import { Model } from '../model';
import { Global } from '../register';
import { MVC } from './mvc';

const Oops = issues({
  AlreadyExists: (name) =>
    `Shared instance of ${name} already exists! Consider unmounting existing, or use ${name}.reset() to force-delete it.`,

  DoesNotExist: (name) =>
    `Tried to access singleton ${name}, but none exist! Did you forget to initialize?\nCall ${name}.new() before attempting to access, or consider using ${name}.use() instead.`,

  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  MultipleExist: (name) =>
    `Did find ${name} in context, but multiple were defined by same Provider.`
})

const LookupContext = React.createContext(Global);

function useLookup(){
  try {
    return React.useContext(LookupContext);
  }
  catch(err){
    return Global;
  }
};

function useContext <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;
function useContext <T extends Model> (Type: Model.Type<T>, required?: boolean): T;

function useContext<T extends Model>(Type: Model.Type<T>, required?: boolean): T | undefined {
  const instance = useLookup().get(Type);

  if(instance === null)
    throw Oops.MultipleExist(Type.name);

  if(!instance && required !== false)
    throw MVC.isTypeof(Type) && Type.global
      ? Oops.DoesNotExist(Type.name)
      : Oops.NotFound(Type.name);

  return instance;
}

export {
  Oops,
  useLookup,
  useContext,
  LookupContext
}