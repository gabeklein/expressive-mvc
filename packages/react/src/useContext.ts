import Model, { Context } from '@expressive/mvc';
import { createContext as reactCreateContext, createElement, ReactNode, useContext as reactUseContext } from 'react';

const Shared = reactCreateContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

function useContext(){
  return reactUseContext(Shared);
}

function createContext(value: Context, children?: ReactNode){
  return createElement(Shared.Provider, { key: value.id, value }, children);
}

function fromContext<T extends Model>(
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

export { createContext, fromContext, setContext, useContext };
export { useState, useEffect, useMemo } from 'react';