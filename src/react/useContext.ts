import React from 'react';

import { issues } from '../helper/issues';
import { Model } from '../model';
import { Register } from '../register';

const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  MultipleExist: (name) =>
    `Did find ${name} in context, but multiple were defined by same Provider.`
})

const Global = new Register();
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
    throw Oops.NotFound(Type.name);

  return instance;
}

export {
  Oops,
  useLookup,
  useContext,
  LookupContext
}