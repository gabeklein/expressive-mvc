import React from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from '../object';
import { Callback } from '../types';

const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

class Lookup {
  private table = new Map<Model.Type, symbol>();

  public get local(){
    return [
      ...new Set(getOwnPropertySymbols(this).map(
        symbol => (this as any)[symbol] as Model
      ))
    ]
  }

  private key(T: Model.Type){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: Model.Type){
    return (this as any)[this.key(T)];
  }

  public push(){
    return create(this) as this;
  }

  public inject(
    T: Model.Type,
    I: Model,
    writable?: boolean){

    do {
      const key = this.key(T);
      const conflict = this.hasOwnProperty(key);

      defineProperty(this, key, {
        value: conflict ? null : I,
        configurable: true,
        writable
      });

      T = getPrototypeOf(T);
    }
    while(T !== Model);
  }

  public pop(){
    const items = new Set<Model>();

    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        items.add(entry.value)
    }

    for(const model of items)
      model.kill();
  }
}

const LookupContext = React.createContext(new Lookup());
const useLookup = () => React.useContext(LookupContext);

function useContext <T extends Model> (Type: Model.Type<T>, required: false):T | undefined;
function useContext <T extends Model> (Type: Model.Type<T>, arg?: boolean):T;
function useContext <T extends Model> (Type: Model.Type<T>, effect: (found: T) => Callback | void): T;
function useContext <T extends Model, K extends Model.Field<T>> (Type: Model.Type<T>, key: K): T[K];

function useContext<T extends Model>(
  Type: Model.Type<T>,
  arg?: boolean | string | ((found: T) => Callback | void)) {

  const instance = useLookup().get(Type);

  if(!instance && arg !== false)
    throw Oops.NotFound(Type.name);

  switch(typeof arg){
    case "string":
      return (instance as any)[arg];

    case "function":
      React.useLayoutEffect(() => arg(instance), []);

    default:
      return instance;
  }
}

export { Lookup, useLookup, useContext, Oops, LookupContext }