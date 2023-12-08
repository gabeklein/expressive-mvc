import Model, { Context } from '@expressive/mvc';
import { createContext as reactCreateContext, createElement, ReactNode, useContext as reactUseContext } from 'react';

type RegisterCallback<T = any> = (model: T) => void | boolean | (() => void);

const Shared = reactCreateContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();
const Expects = new WeakMap<Model, Map<Model.Type, RegisterCallback>>();

function useContext(){
  return reactUseContext(Shared);
}

function createContext(value: Context, children?: ReactNode){
  return createElement(Shared.Provider, { key: value.key, value }, children);
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
  const callback = context.get(model.constructor as Model.Type, true);

  if(callback)
    callback(model);
    
  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}

function expect(model: Model, T: Model.Type, callback: RegisterCallback){
  let map = Expects.get(model);

  if(!map)
    Expects.set(model, map = new Map());

  map.set(T, callback);
}

function inject(model: Model, context: Context){
  const expects = Expects.get(model);

  if(expects)
    for(let [T, callback] of expects)
      context.put(T as Model.New, callback);
}

export { RegisterCallback, expect, inject, createContext, getContext, setContext, useContext };
export { useState, useEffect, useMemo } from 'react';