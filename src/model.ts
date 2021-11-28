import * as Computed from './compute';
import { useFromContext } from './context';
import { CONTROL, Controller, keys, LOCAL, manage, STATE, Stateful } from './controller';
import { useLazy, useModel, useSubscriber, useWatcher } from './hooks';
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

  static [CONTROL]: Controller;

  constructor(){
    const control = Controller.setup(this);

    define(this, "get", this);
    define(this, "set", this);

    defer(control, "on");
    defer(control, "effect");

    control.include(() => {
      delete (this as any).on;
      delete (this as any).effect;
    })
  }

  tap(path?: string | Select, expect?: boolean){
    const proxy = useWatcher(this, path, expect);
    this.update("willRender", true);
    return proxy;
  }

  tag(id?: Key | KeyFactory<this>){
    return useSubscriber(this, id);
  }

  on(
    subset: string | Iterable<string> | Query,
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const control = manage(this);
    const set = keys(control, subset);
    const batch = {} as BunchOf<RequestCallback>;
    const remove = control.addListener(batch);

    const callback: RequestCallback = squash
      ? handler.bind(this)
      : (frame: string[]) => {
        for(const key of frame)
          if(set.includes(key))
            handler.call(this, control.state[key], key);
      }

    const handle = once
      ? (k: string[]) => { remove(); callback(k) }
      : callback;

    for(const key of set)
      batch[key] = handle;

    Computed.ensure(control, set);

    return remove;
  }

  once(
    select: string | Iterable<string> | Query,
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

  update(strict?: boolean): Promise<string[] | false>;
  update(select?: Select): PromiseLike<string[]>;
  update(key: string | Select, callMethod: boolean): PromiseLike<string[]>;
  update(key: string | Select, tag?: any): PromiseLike<string[]>;
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

    return <PromiseLike<string[] | false>> {
      then(callback){
        if(callback)
          if(control.pending)
            control.include(callback);
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

  static new(args: any[], callback?: (instance: Model) => void){
    const instance = useLazy(this, args, callback);
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

  static use(args: any[], callback?: (instance: Model) => void){
    const instance = useModel(this, args, callback);
    useComponentLifecycle(instance[LOCAL]);
    usePeerContext(instance.get);
    return instance;
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return this.use([], instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = this.use([]);
    instance.import(props, only);
    return instance;
  }

  static meta(path: string | Select): any {
    return useWatcher(this, path);
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
    waiting.push(() => {
      done = real.apply(subject, args);
    });
    return () => done();
  }
}