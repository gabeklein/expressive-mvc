import Model, { Context } from '@expressive/mvc';
import React from 'react';

const Shared = React.createContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

function useContext(){
  return React.useContext(Shared);
}

function createContext(value: Context, children?: React.ReactNode){
  return React.createElement(Shared.Provider, { key: value.id, value }, children);
}

function usingContext<T extends Model>(
  this: Model.Type<T>,
  from: Model,
  resolve: (got: T | undefined) => void){

  const waiting = Register.get(from);
  const context = (context: Context) => {
    resolve(context.get(this));
  }

  if(waiting instanceof Context)
    context(waiting);
  else if(waiting)
    waiting.push(context);
  else
    Register.set(from, [context]);
}

function setContext(model: Model, context: Context){
  const waiting = Register.get(model);
    
  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}

export const hooks = {
  useContext,
  setContext,
  createContext,
  useState: React.useState,
  useEffect: React.useEffect,
  useMemo: React.useMemo
}

export { createContext, usingContext, setContext };