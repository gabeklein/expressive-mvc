import type Public from '../types';

import { useLookup } from './context';
import { Controllable, Controller, DISPATCH } from './controller';
import { useModel, useLazy, usePassive, useSubscriber, useWatcher } from './hooks';
import { define, entries, fn, getPrototypeOf } from './util';

import Oops from './issues';

type Select = <T>(from: T) => T[keyof T];

export interface Model extends Public {};

export class Model {
  [DISPATCH]: Controller;
  
  constructor(){
    const cb = this.didCreate;

    const dispatch = this[DISPATCH] =
      new Controller(this);

    if(cb)
      dispatch.requestUpdate(cb.bind(this));

    define(this, "get", this);
    define(this, "set", this);

    for(const [key, value] of entries(dispatch))
      if(fn(value))
        define(this, key, value);
  }

  get bind(): never {
    throw Oops.BindNotAvailable();
  }

  public tap(path?: string | Select, expect?: boolean){
    return useWatcher(this, path, expect) as any;
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

    instance[DISPATCH].start();

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

  static tap(key?: string | Select, expect?: boolean){
    return this.find(true).tap(key, expect);
  }

  static sub(...args: any[]){
    return this.find(true).sub(...args);
  }

  static [DISPATCH]?: Controller;

  static meta(path: string | Select): any {
    return useWatcher(() => {
      const self = this as Controllable;

      if(!this[DISPATCH])
        this[DISPATCH] = new Controller(self);

      return self;
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