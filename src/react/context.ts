import React from 'react';

import { Parent } from '../children';
import { Control } from '../control';
import { issues } from '../helper/issues';
import {
  create,
  defineProperty,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  getPrototypeOf,
  unique,
} from '../helper/object';
import { Model } from '../model';

const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

class Lookup {
  private table = new Map<Model.Type, symbol>();

  public get local(){
    return unique<Model>(
      getOwnPropertySymbols(this).map(
        symbol => (this as any)[symbol]
      )
    )
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

  public add(input: Model.Type | Model){
    let writable = true;
    let T: Model.Type;
    let I: Model;

    if(typeof input == "function"){
      T = input;
      I = input.new();
    }
    else {
      I = input;
      T = I.constructor as Model.Type;
      writable = false;
    }

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

    return I;
  }

  public push(){
    return create(this) as this;
  }

  public pop(){
    const items = new Set<Model>();

    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        items.add(entry.value)
    }

    for(const model of items)
      model.end();
  }
}

const LookupContext = React.createContext(new Lookup());
const useLookup = () => React.useContext(LookupContext);

function useContext <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;
function useContext <T extends Model> (Type: Model.Type<T>, required?: boolean): T;

function useContext<T extends Model>(Type: Model.Type<T>, required?: boolean): T | undefined {
  const instance = useLookup().get(Type);

  if(!instance && required !== false)
    throw Oops.NotFound(Type.name);
  
  return instance;
}

export { Lookup, useLookup, useContext, Oops, LookupContext }