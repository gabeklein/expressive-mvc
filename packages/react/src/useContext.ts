import { Model, Register } from '@expressive/mvc';
import React from 'react';

const LookupContext = React.createContext(new Register());

function useLookup(){
  return React.useContext(LookupContext);
};

function useContext <T extends Model> (this: Model.Type<T>, required: false): T | undefined;
function useContext <T extends Model> (this: Model.Type<T>, required?: boolean): T;
function useContext<T extends Model>(this: Model.Type<T>, required?: boolean): T | undefined {
  return useLookup().get(this, required);
}

export {
  useLookup,
  useContext,
  LookupContext
}