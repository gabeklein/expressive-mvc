import { useFromContext } from './context';
import { useLazy, useModel, usePassive, useSubscriber, useWatcher } from './hooks';
import { issues } from './issues';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, fn, getPrototypeOf } from './util';

export const CONTROL = Symbol("controller");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

export interface Stateful {
  [CONTROL]: Observer;
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
    const control = new Observer(this);

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

      this[STATE] = control.state;

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

    const control = this[CONTROL];

    return control.do(() => {
      return control.watch(
        control.keys(select), listener, squash, once
      )
    });
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
    const start = select
      ? () => {
        invoke();
        return this.on(select, invoke, true);
      }
      : () => {
        const sub = control.subscribe(invoke);
        effect(target = sub.proxy);
        return sub.commit();
      }

    return control.do(start);
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

    if(fn(arg))
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

  static [CONTROL]: Observer;

  static create<T extends typeof Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    Observer.ensure(instance);

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
      fn(maybe) && maybe.prototype instanceof this
    )
  }

  static get inherits(): typeof Model | undefined {
    const I = getPrototypeOf(this);

    if(I !== Model)
      return I;
  }
}

defineLazy(Model, CONTROL, function(){
  return new Observer(this).start();
})