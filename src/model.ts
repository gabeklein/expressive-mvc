import * as Computed from './compute';
import { useContext } from './context';
import { Controller } from './controller';
import { useActive, useComputed, useModel, useNew, usePassive, useTag, useTap } from './hooks';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getOwnPropertyNames } from './util';

export const CONTROL = Symbol("control");
export const UPDATE = Symbol("update");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export interface Stateful {
  [CONTROL]: Controller;
  [UPDATE]?: readonly string[];
  [LOCAL]?: Subscriber;
  [STATE]?: any;

  didCreate?(): void;
};

export interface Model extends Stateful {
  get: this;
  set: this;

  didCreate?: Callback;
  willDestroy?: Callback;
}

export class Model {
  static CONTROL = CONTROL;
  static STATE = STATE;
  static LOCAL = LOCAL;
  static WHY = UPDATE;

  static [CONTROL]: Controller;
  static [UPDATE]: readonly string[];

  constructor(){
    const control = new Controller(this);

    defineLazy(this, CONTROL, () => {
      this[STATE] = control.state;
      control.start();

      if(this.didCreate)
        this.didCreate();

      return control;
    })

    define(this, "get", this);
    define(this, "set", this);

    defer(control, "on");
    defer(control, "effect");

    control.waiting.add(() => {
      delete (this as any).on;
      delete (this as any).effect;
    })
  }

  tap(path?: string | Function, expect?: boolean){
    return useTap(this, path, expect);
  }

  tag(id?: Key | KeyFactory<this>){
    return useTag(this, id);
  }

  use(callback?: (instance: Model) => void){
    return useNew(this, callback);
  }

  on(
    select: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const control = this[CONTROL];

    if(typeof select == "string")
      select = [select];
    else if(!select.length)
      select = getOwnPropertyNames(control.state)

    const callback: RequestCallback = squash
      ? handler.bind(this)
      : frame => frame
        .filter(k => select.includes(k))
        .forEach(k => handler.call(this, control.state[k], k))

    const trigger: RequestCallback = once
      ? frame => { remove(); callback(frame) }
      : callback;

    Computed.ensure(control, select);

    const remove = control.addListener(key => {
      if(select.includes(key))
        return trigger;
    });

    return remove;
  }

  once(
    select: string | string[],
    callback?: UpdateCallback<any, any>,
    squash?: boolean){

    if(callback)
      return this.on(select, callback, squash, true);

    return new Promise<void>(resolve => {
      this.on(select, resolve, true, true);
    });
  }

  effect(
    callback: EffectCallback<any>,
    select?: string[]){

    let target = this;

    const effect = createEffect(callback);
    const invoke = () => effect.call(target, target);

    if(select){
      invoke();
      return this.on(select, invoke, true);
    }
    
    const sub = new Subscriber(this, () => invoke);
    target = sub.proxy;
    invoke();
    return sub.commit();
  }

  import(
    from: BunchOf<any>,
    subset?: Set<string> | string[]){

    for(const key of subset || getOwnPropertyNames(this))
      if(key in from)
        (this as any)[key] = from[key];
  }

  export(subset?: Set<string> | string[]){
    const { state } = this[CONTROL];
    const output: BunchOf<any> = {};

    for(const key of subset || getOwnPropertyNames(state))
      output[key] = (state as any)[key];

    return output;
  }

  update(strict?: boolean): Promise<string[] | false>;
  update(select: string, callMethod: boolean): PromiseLike<readonly string[]>;
  update(select: string, tag?: any): PromiseLike<readonly string[]>;
  update(arg?: string | boolean, tag?: any){
    const control = this[CONTROL];

    if(typeof arg == "string"){
      control.update(arg);

      if(1 in arguments && arg in this){
        const method = (this as any)[arg];

        if(typeof method == "function")
          if(typeof tag != "boolean")
            method.call(this, tag);
          else if(tag)
            method.call(this);
      }

      arg = undefined;
    }

    return control.requestUpdate(arg);
  }

  destroy(){
    this.update("willDestroy", true);
  }

  toString(){
    return this.constructor.name;
  }

  static create<T extends Class>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    instance[CONTROL];

    return instance;
  }

  static new(callback?: (instance: Model) => void){
    return usePassive(this, callback);
  }

  static get(key?: boolean | string){
    const instance = useContext(this, key !== false);
  
    return (
      typeof key == "string" ?
        (instance as any)[key] :
        instance
    )
  }

  static tap(key?: string, expect?: boolean): any {
    return this.get().tap(key, expect);
  }

  static tag(id?: Key | ((target: Model) => Key | undefined)){
    return this.get().tag(id);
  }

  static use(callback?: (instance: Model) => void){
    return useModel(this, callback);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return this.use(instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = this.use();
    instance.import(props, only);
    return instance;
  }

  static meta(path: string | Function): any {
    return typeof path == "function"
      ? useComputed(this, path)
      : useActive(this, path)
  }

  static isTypeof<T extends typeof Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}

defineLazy(Model, CONTROL, function(){
  return new Controller(this).start();
})

function defer(on: Controller, method: string){
  const { subject, waiting } = on as any;
  const real = subject[method];

  subject[method] = (...args: any[]) => {
    let done: any;
    waiting.add(() => {
      done = real.apply(subject, args);
    });
    return () => done();
  }
}