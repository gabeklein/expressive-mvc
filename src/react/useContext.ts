import React from 'react';

import { issues } from '../helper/issues';
import { Model } from '../model';
import { Lookup } from './lookup';

const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

const LookupContext = React.createContext(new Lookup());
const useLookup = () => React.useContext(LookupContext);

function useContext <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;
function useContext <T extends Model> (Type: Model.Type<T>, required?: boolean): T;

function useContext<T extends Model>(Type: Model.Type<T>, required?: boolean): T | undefined {
  const instance = useLookup().get(Type);

  if (!instance && required !== false)
    throw Oops.NotFound(Type.name);

  return instance;
}

export {
  Oops,
  useLookup,
  useContext,
  LookupContext
}