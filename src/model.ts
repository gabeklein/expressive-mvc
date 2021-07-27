import { useFromContext } from './context';
import { Controller } from './controller';
import { useLazy, useModel, usePassive, useSubscriber, useWatcher } from './hooks';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getPrototypeOf } from './util';

export const CONTROL = Symbol("controller");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

export interface Stateful {
  [CONTROL]: Controller;
  [LOCAL]?: Subscriber;
  [STATE]?: any;
};

export interface Model extends Stateful {
  get: this;
  set: this;

  didCreate?: Callback;
  willDestroy?: Callback;
};

export class Model {
  constructor(){
    const control = new Controller(this);

    define(this, "get", this);
    define(this, "set", this);

    defer(control, "on");
    defer(control, "effect");

    defineLazy(this, CONTROL, () => {
      delete (this as any).on;
      delete (this as any).effect;

      this[STATE] = control.state;

      control.start();

      if(this.didCreate)
        this.didCreate();

      return control;
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
    listener: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean){

    return this[CONTROL].watch(
      select, listener, squash, once
    )
  }

  once(
    select: string | Iterable<string> | Query,
    listener?: UpdateCallback<any, any>,
    squash?: boolean){

    if(listener)
      return this.on(select, listener, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.on(select, resolve, true, true);
      });
  }

  effect(
    callback: EffectCallback<any>,
    select?: string[] | Query){

    const control = this[CONTROL];
    let target = control.subject;

    const effect = createEffect(callback);
    const invoke = () => effect(target);

    if(select){
      invoke();
      return this.on(select, invoke, true);
    }
    else {
      const sub = control.subscribe(invoke);
      effect(target = sub.proxy);
      return sub.commit();
    }
  }

  import(
    from: BunchOf<any>,
    select?: Iterable<string> | Query){

    const control = this[CONTROL];

    for(const key of control.keys(select))
      if(key in from)
        (control.subject as any)[key] = from[key];
  }

  export(select?: Iterable<string> | Query){
    const control = this[CONTROL];
    const output: BunchOf<any> = {};

    for(const key of control.keys(select))
      output[key] = (control.state as any)[key];

    return output;
  }

  update(select: string | string[] | Query){
    const control = this[CONTROL];

    for(const key of control.keys(select))
      control.update(key);
  }

  requestUpdate(arg?: RequestCallback | boolean){
    const { pending, waiting } = this[CONTROL];

    if(typeof arg == "function")
      waiting.push(arg)
    else if(!pending === arg)
      return Promise.reject(Oops.StrictUpdate(arg))
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }

  destroy(){
    if(this.willDestroy)
      this.willDestroy();
  }

  static STATE = STATE;
  static CONTROL = CONTROL;
  static LOCAL = LOCAL;

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

function defer(on: Controller, method: string){
  const target: any = on.subject;
  const real = target[method];

  target[method] = (...args: any[]) => {
    let release: any;
    on.waiting.push(() => {
      release = real.apply(target, args);
    });
    return () => release();
  }
}