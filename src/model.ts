import * as Computed from './compute';
import { useFromContext } from './context';
import { Controller } from './controller';
import { use, useComputed, useLazy, useModel, useWatcher } from './hooks';
import { lifecycle } from './lifecycle';
import { usePeerContext } from './peer';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, getOwnPropertyNames } from './util';

const useElementLifecycle = lifecycle("element");
const useComponentLifecycle = lifecycle("component");

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

export function manage(src: Stateful){
  return src[CONTROL];
}

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
    if(typeof path == "function")
      return useComputed(this, path, expect);

    const proxy = useWatcher(this, path, expect);
    this.update("willRender", true);
    return proxy;
  }

  tag(id?: Key | KeyFactory<this>){
    const hook = use(refresh => (
      new Subscriber(this, () => refresh)
    ));
  
    useElementLifecycle(hook, id || 0);
    
    return hook.proxy;
  }

  use(callback?: (instance: Model) => void){
    const hook = use(refresh => {
      if(callback)
        callback(this);

      return new Subscriber(this, () => refresh);
    });
  
    useComponentLifecycle(hook);
    
    return hook.proxy;
  }

  on(
    select: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const control = manage(this);

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

    const control = manage(this);
    let target = this;

    const effect = createEffect(callback);
    const invoke = () => effect.call(target, target);

    if(select){
      invoke();
      return this.on(select, invoke, true);
    }
    
    const sub = new Subscriber(control, () => invoke);
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
    const { state } = manage(this);
    const output: BunchOf<any> = {};

    for(const key of subset || getOwnPropertyNames(state))
      output[key] = (state as any)[key];

    return output;
  }

  update(strict?: boolean): Promise<string[] | false>;
  update(select: string, callMethod: boolean): PromiseLike<readonly string[]>;
  update(select: string, tag?: any): PromiseLike<readonly string[]>;
  update(arg?: string | boolean, tag?: any){
    const control = manage(this);

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

    manage(instance);

    return instance;
  }

  static new(callback?: (instance: Model) => void){
    const instance = useLazy(this, callback);
    instance.update("willRender", true);
    return instance
  }

  static get(key?: boolean | string){
    const instance = useFromContext(this, key !== false);
  
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
    const instance = useModel(this, callback);
    useComponentLifecycle(instance[LOCAL]);
    usePeerContext(instance.get);
    return instance;
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
      : useWatcher(this, path)
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