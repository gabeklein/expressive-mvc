import React from 'react';

import { issues } from '../helper/issues';
import {
  create,
  defineProperty,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  getPrototypeOf,
} from '../helper/object';
import { Model } from '../model';
import { MVC } from './mvc';

const Oops = issues({
  NotFound: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`
})

class Lookup {
  private table = new Map<Model.Type, symbol>();
  private register!: Map<string | number, Model | Model.Type>;

  private key(T: Model.Type){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key as keyof this;
  }

  public get<T extends Model>(Type: Model.Type<T>){
    return this[this.key(Type)] as unknown as T | undefined;
  }

  public has<T extends Model>(
    key: string | number,
    input: Model.Constructor<T> | T,
    callback?: (i: T) => void){

    if(MVC.isTypeof(input) && input.global)
      return input.new();
  
    if(this.register.get(key) === input)
      return typeof input == "object"
        ? input
        : this.get(input)!;

    const instance = this.add(input) as T;

    this.register.set(key, input);

    if(callback)
      callback(instance);

    return instance;
  }

  public add(input: Model.Constructor | Model): Model {
    let writable = true;
    let T: Model.Constructor;
    let I: Model;

    if(typeof input == "function"){
      T = input;
      I = new input();
    }
    else {
      I = input;
      T = I.constructor as Model.Constructor;
      writable = false;
    }

    do {
      const key = this.key(T);

      defineProperty(this, key, {
        configurable: true,
        value: this.hasOwnProperty(key) ? null : I,
        writable
      });

      T = getPrototypeOf(T);
    }
    while(T !== Model);

    return I;
  }

  public push(){
    const next = create(this) as this;
    next.register = new Map();
    return next;
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