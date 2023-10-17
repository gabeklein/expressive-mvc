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

export function getContext(model: Model, resolve: (got: Context) => void){
  const waiting = Register.get(model);

  if(waiting instanceof Context)
    resolve(waiting);
  else if(waiting)
    waiting.push(resolve);
  else
    Register.set(model, [resolve]);
}

export function setContext(model: Model, context = useContext()){
  const waiting = Register.get(model);

  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}