import * as Computed from './compute';
import { useFromContext } from './context';
import { CONTROL, Controller, keys, LOCAL, manage, STATE, Stateful, UPDATE } from './controller';
import { use, useComputed, useLazy, useModel, useWatcher } from './hooks';
import { issues } from './issues';
import { lifecycle } from './lifecycle';
import { usePeerContext } from './peer';
import { Subscriber } from './subscriber';
import { createEffect, define, defineLazy, select } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
})

const useElementLifecycle = lifecycle("element");
const useComponentLifecycle = lifecycle("component");

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
    const control = Controller.setup(this);

    define(this, "get", this);
    define(this, "set", this);

    defer(control, "on");
    defer(control, "effect");

    control.waiting.add(() => {
      delete (this as any).on;
      delete (this as any).effect;
    })
  }

  tap(path?: string | Select, expect?: boolean){
    if(typeof path == "function")
      return useComputed(this, path, expect);

    const proxy = useWatcher(this, path, expect);
    this.update("willRender", true);
    return proxy;
  }

  tag(id?: Key | KeyFactory<this>){
    const hook = use(refresh => {
      return new Subscriber(this, () => refresh);
    });
  
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
    subset: string | string[] | Set<string> | Query,
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const control = manage(this);
    const request = keys(control, subset);

    const callback: RequestCallback = squash
      ? handler.bind(this)
      : frame => frame
        .filter(k => request.includes(k))
        .forEach(k => handler.call(this, control.state[k], k))

    const trigger: RequestCallback = once
      ? frame => { remove(); callback(frame) }
      : callback;

    Computed.ensure(control, request);

    const remove = control.addListener(key => {
      if(request.includes(key))
        return trigger;
    });

    return remove;
  }

  once(
    select: string | string[] | Set<string> | Query,
    callback?: UpdateCallback<any, any>,
    squash?: boolean){

    if(callback)
      return this.on(select, callback, squash, true);
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
      const sub = new Subscriber(control, () => invoke);
      target = sub.proxy;
      invoke();
      return sub.commit();
    }
  }

  import(
    from: BunchOf<any>,
    subset?: Set<string> | string[] | Query){

    for(const key of keys(manage(this), subset))
      if(key in from)
        (this as any)[key] = from[key];
  }

  export(subset?: Set<string> | string[] | Query){
    const control = manage(this);
    const output: BunchOf<any> = {};

    for(const key of keys(control, subset))
      output[key] = (control.state as any)[key];

    return output;
  }

  update(strict?: boolean): Promise<string[] | false>;
  update(select?: Select): PromiseLike<string[]>;
  update(key: string | Select, callMethod: boolean): PromiseLike<readonly string[]>;
  update(key: string | Select, tag?: any): PromiseLike<readonly string[]>;
  update(arg?: string | boolean | Select, tag?: any){
    const control = manage(this);

    if(typeof arg == "function")
      arg = select(this, arg);

    if(typeof arg == "boolean"){
      if(!control.pending === arg)
        return Promise.reject(Oops.StrictUpdate(arg))
    }
    else if(arg){
      control.update(arg);

      if(1 in arguments && arg in this){
        const method = (this as any)[arg];

        if(typeof method == "function")
          if(typeof tag != "boolean")
            method.call(this, tag);
          else if(tag)
            method.call(this);
      }
    }

    return <PromiseLike<readonly string[] | false>> {
      then(callback){
        if(callback)
          if(control.pending)
            control.waiting.add(callback);
          else
            callback(false);
        else
          throw Oops.NoChaining();
      }
    }
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

  static find<T extends Class>(this: T, strict: true): InstanceOf<T>;
  static find<T extends Class>(this: T, strict?: boolean): InstanceOf<T> | undefined;
  static find<T extends Class>(this: T, strict?: boolean){
    return useFromContext(this, strict);
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
    return this.find(true).tap(key, expect);
  }

  static tag(id?: Key | ((target: Model) => Key | undefined)){
    return this.find(true).tag(id);
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

  static meta(path: string | Select): any {
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