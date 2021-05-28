import type Public from '../types';

import { createBindAgent } from './binding';
import { useLookup } from './context';
import { Dispatch } from './dispatch';
import { useModel, useLazily, usePassive, useSubscriber, useWatcher } from './hooks';
import { assignSpecific, define, entries, fn, getPrototypeOf } from './util';

import Oops from './issues';

export interface Model extends Public {};

export class Model {
  constructor(){
    const cb = this.didCreate;
    const dispatch =  Dispatch.set(this, Model)!;

    if(cb)
      dispatch.requestUpdate(cb.bind(this));

    define(this, { get: this, set: this });

    for(const [key, value] of entries(dispatch))
      if(fn(value))
        define(this, key, value);
  }

  public get bind(){
    const agent = createBindAgent(this);
    define(this.get, { bind: agent });
    return agent as any;
  }

  public tap(path?: string | SelectFunction<any>){
    return useWatcher(this, path) as any;
  }

  public sub(...args: any[]){
    return useSubscriber(this, args) as any;
  }

  public destroy(){
    Dispatch.get(this).emit("willDestroy", []);
  }

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    Dispatch.get(instance);

    return instance;
  }

  static use(...args: any[]){
    return useModel(this, args);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return useModel(this, [], instance => {
      assignSpecific(instance, props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = useModel(this, []);

    assignSpecific(instance, props, only);

    return instance;
  }

  static memo(...args: any[]){
    return useLazily(this, args);
  }

  static get(key?: boolean | string | SelectFunction<any>){
    return usePassive(this, key);
  }

  static tap(key?: string | SelectFunction<any>){
    return this.find(true).tap(key);
  }

  static sub(...args: any[]){
    return this.find(true).sub(...args);
  }

  static has(key: string){
    const value = this.tap(key);

    if(value === undefined)
      throw Oops.HasPropertyUndefined(this.name, key);

    return value;
  }

  static meta(path: string | SelectFunction<any>): any {
    return useWatcher(() => {
      Dispatch.set(this, Model);
      return this;
    }, path);
  }

  static find(strict: true): Model;
  static find(strict?: boolean): Model | undefined;
  static find(strict?: boolean){
    return useLookup().get(this, strict);
  }

  static isTypeof<T extends typeof Model>(
    this: T, maybe: any): maybe is T {

    return (
      fn(maybe) && 
      maybe.prototype instanceof this
    )
  }

  static get inherits(): typeof Model | undefined {
    const I = getPrototypeOf(this);

    if(I !== Model)
      return I;
  }
}