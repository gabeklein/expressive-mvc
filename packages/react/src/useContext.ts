import Model, { Context } from '@expressive/mvc';
import React from 'react';

const Shared = React.createContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

export function useContext(){
  return React.useContext(Shared);
}

export function createContext(value: Context, children?: React.ReactNode){
  return React.createElement(Shared.Provider, { key: value.key, value }, children);
}

export function getContext(from: Model, resolve: (got: Context) => void){
  const context = Register.get(from);

  if(context instanceof Context)
    resolve(context);
  else if(context)
    context.push(resolve);
  else
    Register.set(from, [resolve]);
}

export function setContext(model: Model, context = useContext()){
  const waiting = Register.get(model);

  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}