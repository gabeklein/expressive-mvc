import * as Computed from './compute';
import { Controller } from './controller';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getOwnPropertyNames } from './util';

export const CONTROL = Symbol("CONTROL");
export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");

export interface Stateful {
  [CONTROL]: Controller;
  [WHY]?: readonly string[];
  [LOCAL]?: Subscriber;
  [STATE]?: any;
};

export const UPDATE = new WeakMap<{}, readonly string[]>();

export interface Model extends Stateful {
  get: this;
  set: this;
}

export function ensure(
  subject: Stateful,
  callback: (control: Controller) => Callback | void){

  const control = subject[CONTROL];

  if(!control.state){
    let done: Callback | void;

    control.requestUpdate(() => {
      done = callback(control);
    });

    return () => done && done();
  }

  return callback(control);
}

export function getController(subject: Stateful){
  const control = subject[CONTROL];

  if(!control.state)
    control.start();

  return control;
}

export class Model {
  static CONTROL = CONTROL;
  static STATE = STATE;
  static LOCAL = LOCAL;
  static WHY = WHY;

  static [CONTROL]: Controller;
  static [WHY]: readonly string[];

  constructor(){
    define(this, CONTROL, new Controller(this));
    define(this, "get", this);
    define(this, "set", this);
  }

  get [STATE](){
    return this[CONTROL].state;
  }

  get [WHY](){
    return UPDATE.get(this);
  }

  on(
    select: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    return ensure(this, control => {
      const keys = 
        typeof select == "string" ? [select] :
        !select.length ? getOwnPropertyNames(control.state) :
        select;

      Computed.ensure(control, keys);

      const callback: RequestCallback = squash
        ? handler.bind(this)
        : frame => frame
          .filter(k => keys.includes(k))
          .forEach(k => handler.call(this, control.state[k], k))

      const trigger: RequestCallback = once
        ? frame => { remove(); callback(frame) }
        : callback;

      const remove = control.addListener(key => {
        if(keys.includes(key))
          return trigger;
      });

      return remove;
    });
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

    const effect = createEffect(callback);

    return ensure(this, control => {
      if(!select){
        const sub = new Subscriber(control, () => invoke);
        const invoke = () => {
          const x = sub.proxy;
          effect.call(x, x);
        }

        invoke();

        return sub.commit();
      }

      const invoke = () => {
        effect.call(this.get, this.get);
      }

      invoke();

      if(!select.length){
        control.onDestroy.add(invoke);
        return () => {
          control.onDestroy.delete(invoke);
        }
      }

      return control.addListener(key => {
        if(select.includes(key))
          return invoke;
      });
    })
  }

  import(
    from: BunchOf<any>,
    subset?: Set<string> | string[]){

    for(const key of subset || getOwnPropertyNames(this))
      if(key in from)
        (this as any)[key] = from[key];
  }

  export(subset?: Set<string> | string[]){
    const { state } = getController(this);
    const output: BunchOf<any> = {};

    for(const key of subset || getOwnPropertyNames(state))
      output[key] = (state as any)[key];

    return output;
  }

  update(strict?: boolean): Promise<string[] | false>;
  update(select: string, callMethod: boolean): PromiseLike<readonly string[]>;
  update(select: string, tag?: any): PromiseLike<readonly string[]>;
  update(arg?: string | boolean, tag?: any){
    const control = getController(this);

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
    ensure(this, control => {
      control.onDestroy.forEach(x => x());
    })
  }

  toString(){
    return this.constructor.name;
  }

  static create<T extends Class>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    getController(instance);

    return instance;
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
  return new Controller(this);
})