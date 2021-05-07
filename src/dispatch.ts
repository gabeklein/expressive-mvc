import type { Controller } from './controller';

import { Pending } from './directives';
import { Observer, RequestCallback } from './observer';
import { Subscriber } from './subscriber';
import {
  assign,
  createEffect,
  defineProperty,
  fn,
  debounce,
  within
} from './util';

import Oops from './issues';

const ASSIGNED = new WeakMap<{}, Dispatch>();

export class Dispatch extends Observer {
  private ready = false;

  static ensure(on: {}, base: typeof Controller){
    if(!ASSIGNED.has(on))
      return new Dispatch(on, base);
  }

  static get(from: {}){
    let dispatch = ASSIGNED.get(from);

    if(!dispatch)
      throw Oops.NoObserver(from.constructor.name);

    if(!dispatch.ready){
      dispatch.ready = true;
      dispatch.start();
  
      if(dispatch.onReady)
        dispatch.onReady();
    }

    return dispatch;
  }

  constructor(
    public subject: {},
    base: typeof Controller,
    protected onReady?: Callback){

    super(subject, base);
    ASSIGNED.set(subject, this);
    this.acceptEarly();
  }

  private acceptEarly(){
    const { watch } = this;

    this.watch = (...args) => {
      let undo: Callback;
      this.requestUpdate(() => {
        undo = watch.apply(this, args)
      })
      return () => undo();
    }

    this.requestUpdate(() => {
      delete (this as any).watch;
    })
  }

  protected manageProperty(
    key: string, desc: PropertyDescriptor){

    if(desc.value instanceof Pending)
      desc.value.applyTo.call(this, key);
    else
      super.manageProperty(key, desc);
  }

  protected select(using: Selector<this>){
    const found = new Set<string>();
    const spy = {} as Recursive<this>;
  
    for(const key of this.watched)
      defineProperty(spy, key, {
        get(){
          found.add(key);
          return spy;
        }
      });
  
    using(spy);

    return Array.from(found);
  }

  protected watch(
    target: string | Selector<this>,
    handler: (value: any, key: string) => void,
    once?: boolean,
    initial?: boolean){

    if(fn(target))
      [ target ] = this.select(target);

    const callback = () =>
      handler.call(
        this.subject, 
        this.state[target as string],
        target as string
      );

    if(initial)
      callback();

    return this.addListener(target, callback, once);
  }

  public on = (
    property: string | Selector<this>,
    listener: HandleUpdatedValue,
    initial?: boolean) => {

    return this.watch(property, listener, false, initial);
  }

  public once = (
    property: string | Selector<this>,
    listener?: HandleUpdatedValue) => {

    if(listener)
      return this.watch(property, listener, true);
    else
      return new Promise(resolve => {
        this.watch(property, resolve, true)
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Selector<this>) => {
    
    const { subject } = this;
    const invoke = createEffect(callback);
    const reinvoke = debounce(() => invoke(subject));

    if(!select){
      const sub = new Subscriber(subject, reinvoke);
      invoke(sub.proxy);
      return () => sub.release();
    }

    if(fn(select))
      select = this.select(select);

    if(select.length > 1){
      const cleanup = select.map(k => this.addListener(k, reinvoke));
      return () => cleanup.forEach(x => x());
    }

    return this.addListener(select[0], reinvoke);
  }

  public export = (
    select?: string[] | Selector<this>) => {

    if(!select)
      return assign({}, this.state);

    const acc = {} as BunchOf<any>;

    if(fn(select))
      select = this.select(select);
    
    for(const key of select)
      acc[key] = within(this.subject, key);

    return acc;
  }

  public update = (
    select: string | string[] | Selector<this> | BunchOf<any>) => {

    if(typeof select == "string")
      select = [select];
    else if(fn(select))
      select = this.select(select);

    if(Array.isArray(select))
      select.forEach(k => this.emit(k))
    else
      assign(this.subject, select);
  }

  public requestUpdate = (
    argument?: RequestCallback | boolean | number) => {

    const { pending, waiting } = this;

    if(typeof argument == "function")
      waiting.push(argument)
    else if(typeof argument == "number")
      return new Promise(cb => {
        waiting.push(cb);
        setTimeout(cb, argument, false);
      })
    else if(!pending === argument)
      return Promise.reject(Oops.StrictUpdate())
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}

