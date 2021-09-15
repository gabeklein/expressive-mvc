import { useFromContext } from './context';
import { CONTROL, Controller, keys, LOCAL, manage, STATE, Stateful } from './controller';
import { useLazy, useModel, useSubscriber, useWatcher } from './hooks';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getPrototypeOf } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`
})

export interface Model extends Stateful {
  get: this;
  set: this;

  didCreate?: Callback;
  willDestroy?: Callback;
};

export class Model {
  constructor(){
    define(this, "get", this);
    define(this, "set", this);

    Controller.init(this, () => {
      if(this.didCreate)
        this.didCreate();
    })
  }

  tap(path?: string | Select, expect?: boolean){
    return useWatcher(this, path, expect);
  }

  tag(id?: Key | KeyFactory<this>){
    return useSubscriber(this, id);
  }

  on(
    select: string | Iterable<string> | Query,
    does: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean){

    return manage(this).watch(select, does, squash, once);
  }

  once(
    select: string | Iterable<string> | Query,
    does?: UpdateCallback<any, any>,
    squash?: boolean){

    if(does)
      return this.on(select, does, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.on(select, resolve, true, true);
      });
  }

  effect(
    callback: EffectCallback<any>,
    select?: string[] | Query){

    const control = manage(this);
    let target = this;

    const effect = createEffect(callback);
    const invoke = () => effect.call(target, target);

    if(select){
      invoke();
      return this.on(select, invoke, true);
    }
    else {
      const sub = new Subscriber(control, invoke);
      target = sub.proxy;
      invoke();
      return sub.commit();
    }
  }

  import(
    from: BunchOf<any>,
    subset?: Iterable<string> | Query){

    for(const key of keys(manage(this), subset))
      if(key in from)
        (this as any)[key] = from[key];
  }

  export(subset?: Iterable<string> | Query){
    const control = manage(this);
    const output: BunchOf<any> = {};

    for(const key of keys(control, subset))
      output[key] = (control.state as any)[key];

    return output;
  }

  update(arg: string | string[] | Query | boolean){
    const control = manage(this);

    if(typeof arg == "boolean"){
      if(!control.pending === arg)
        return Promise.reject(Oops.StrictUpdate(arg))
    }
    else if(arg)
      for(const key of keys(control, arg))
        control.update(key);

    if(control.pending)
      return new Promise(cb => control.include(cb));

    return Promise.resolve(false);
  }

  destroy(){
    if(this.willDestroy)
      this.willDestroy();
  }

  toString(){
    return this.constructor.name;
  }

  static STATE = STATE;
  static CONTROL = CONTROL;
  static LOCAL = LOCAL;

  static [CONTROL]: Controller;

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    manage(instance);

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
    const instance: any = this.find(!!key);
  
    return (
      typeof key == "function" ?
        key(instance) :
      typeof key == "string" ?
        instance[key] :
        instance
    )
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

  static find(strict?: boolean){
    return useFromContext(this, strict);
  }

  static isTypeof<T extends typeof Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
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
  return new Controller(this).start();
})
