import type Public from '../types';

import { useLookup } from './context';
import { CONTROL, Controller, Stateful } from './controller';
import { useLazy, useModel, usePassive, useSubscriber, useWatcher } from './hooks';
import { define, defineLazy, entries, fn, getPrototypeOf } from './util';

export interface Model extends Public, Stateful {};
export class Model {
  constructor(){
    const control = new Controller(this);

    for(const [key, value] of entries(control))
      if(fn(value))
        define(this, key, value);

    control.do = (fn: () => Callback) => {
      let release: Callback;
      this.requestUpdate(() => release = fn());
      return () => release();
    }

    define(this, "get", this);
    define(this, "set", this);

    defineLazy(this, CONTROL, () => {
      delete (control as any).do;
      control.start();

      if(this.didCreate)
        this.didCreate();

      return control;
    })
  }

  tap(): this;
  tap <K extends keyof this> (key: K, expect?: boolean): this[K];
  tap <K extends keyof this> (key: K, expect: true): Exclude<this[K], undefined>;
  tap <K extends Select> (key: K, expect?: boolean): ReturnType<K>;
  tap <K extends Select> (key: K, expect: true): Exclude<ReturnType<K>, undefined>;
  tap(path?: string | Select, expect?: boolean){
    return useWatcher(this, path, expect);
  }

  tag(id?: Key): this;
  tag(id: KeyFactory<this>): this;
  tag(id?: Key | KeyFactory<this>){
    return useSubscriber(this, id) as this;
  }

  destroy(){
    if(this.willDestroy)
      this.willDestroy();
  }

  static [CONTROL]: Controller;

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    Controller.ensure(instance);

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

  static new(...args: any[]){
    return useLazy(this, args);
  }

  static get(key?: boolean | string | Select){
    return usePassive(this, key);
  }

  static tap(key?: string | Select, expect?: boolean): any {
    return useWatcher(this.find(true), key, expect);
  }

  static tag(id?: Key | ((target: Model) => Key | undefined)){
    return useSubscriber(this.find(true), id);
  }

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

defineLazy(Model, CONTROL, function(){
  const control = new Controller(this);
  control.start();
  return control;
})