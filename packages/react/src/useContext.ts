import Model, { Context } from '@expressive/mvc';
import React from 'react';

const Shared = React.createContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

function useContext(){
  return React.useContext(Shared);
}

function createContext(value: Context, children?: React.ReactNode){
  return React.createElement(Shared.Provider, { key: value.key, value }, children);
}

function getContext(model: Model, resolve: (got: Context) => void){
  const waiting = Register.get(model);

  if(waiting instanceof Context)
    resolve(waiting);
  else if(waiting)
    waiting.push(resolve);
  else
    Register.set(model, [resolve]);
}

function setContext(model: Model, context = useContext()){
  const waiting = Register.get(model);

  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}

export { createContext, getContext, setContext, useContext };
export { useState, useEffect, useMemo } from 'react';