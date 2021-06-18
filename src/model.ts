import type Public from '../types';

import { useLookup } from './context';
import { Controller } from './controller';
import { useModel, useLazy, usePassive, useSubscriber, useWatcher } from './hooks';
import { define, defineLazy, entries, fn, getPrototypeOf } from './util';

import Oops from './issues';

type Select = <T>(from: T) => T[keyof T];

export const DISPATCH = Symbol("controller");
export type Stateful = { [DISPATCH]: Controller };

export interface Model extends Public {};
export class Model {
  [DISPATCH]: Controller;
  
  constructor(){
    const dispatch = new Controller(this);

    for(const [key, value] of entries(dispatch))
      if(fn(value))
        define(this, key, value);

    dispatch.do = (fn: () => Callback) => {
      let release: Callback;
      this.requestUpdate(() => release = fn());
      return () => release();
    }

    defineLazy(this, DISPATCH, () => {
      delete (dispatch as any).do;
      dispatch.start();

      if(this.didCreate)
        this.didCreate();

      return dispatch;
    })

    define(this, "get", this);
    define(this, "set", this);
  }

  get bind(): never {
    throw Oops.BindNotAvailable();
  }
  
  // TODO: reconsile public types; extremely uncooperative.
  public tap(path?: string | Select, expect?: boolean): never {
    // @ts-ignore
    return useWatcher(this, path, expect);
  }

  public sub(...args: any[]){
    return useSubscriber(this, args) as any;
  }

  public destroy(){
    if(this.willDestroy)
      this.willDestroy();
  }

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    instance[DISPATCH];

    return instance;
  }

  static use(...args: any[]){
    return useModel(this, args);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return useModel(this, [], instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = useModel(this, []);

    instance.import(props, only);

    return instance;
  }

  static memo(...args: any[]){
    return useLazy(this, args);
  }

  static get(key?: boolean | string | Select){
    return usePassive(this, key);
  }

  static tap(key?: string | Select, expect?: boolean): any {
    return this.find(true).tap(key, expect);
  }

  static sub(...args: any[]){
    return this.find(true).sub(...args);
  }

  static [DISPATCH]: Controller;

  static meta(path: string | Select): any {
    return useWatcher(this, path);
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

defineLazy(Model, DISPATCH, function(){
  const dispatch = new Controller(this);
  dispatch.start();
  return dispatch;
})