import type { Controller } from './controller';

import { Pending } from './directives';
import { lifecycleEvents } from './lifecycle';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import {
  assign,
  assignSpecific,
  createEffect,
  debounce,
  fn,
  recursiveSelect
} from './util';

import Oops from './issues';

const Register = new WeakMap<{}, Dispatch>();

export class Dispatch extends Observer {
  private ready = false;

  static ensure(on: {}, base: typeof Controller){
    if(!Register.has(on))
      new this(on, base);
  }

  static for(from: {}){
    let dispatch = Register.get(from);

    if(!dispatch)
      throw Oops.NoObserver(from.constructor.name);

    if(!dispatch.ready){
      dispatch.ready = true;
      dispatch.start();
    }

    return dispatch;
  }

  constructor(
    public subject: {},
    base: typeof Controller){

    super(subject, base);
    Register.set(subject, this);
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
      desc.value.applyTo(this, key);
    else
      super.manageProperty(key, desc);
  }

  public select(
    using: string | string[] | QueryFunction<this>){

    if(fn(using))
      return recursiveSelect([
        ...lifecycleEvents,
        ...this.watched
      ], using);

    if(typeof using == "string")
      return [using];

    return using;
  }

  protected watch(
    key: string | QueryFunction<this>,
    handler: (value: any, key: string) => void,
    once?: boolean,
    initial?: boolean){

    const target = this.select(key);

    const callback = () =>
      handler.call(this.subject, this.state[target[0]], target[0]);

    if(initial)
      callback();

    return this.addListener(target, callback, once);
  }

  public emit(event: string, args?: any[]){
    if(args){
      const { subject } = this as any;
      const handle = subject[event];
  
      if(fn(handle))
        handle.apply(subject, args);
    }

    super.emit(event);
  }

  public on = (
    property: string | QueryFunction<this>,
    listener: UpdateCallback<any, any>,
    initial?: boolean) => {

    return this.watch(property, listener, false, initial);
  }

  public once = (
    property: string | QueryFunction<this>,
    listener?: UpdateCallback<any, any>) => {

    if(listener)
      return this.watch(property, listener, true);
    else
      return new Promise(resolve => {
        this.watch(property, resolve, true)
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | QueryFunction<this>) => {
    
    let { subject } = this;
    const effect = createEffect(callback);
    const reinvoke = debounce(() => effect(subject));

    if(!select){
      const sub = new Subscriber(subject, reinvoke);
      effect(subject = sub.proxy);
      return sub.listen();
    }

    select = this.select(select);

    return this.addListener(select, reinvoke);
  }

  public export = (
    select?: string[] | QueryFunction<this>) => {

    if(!select)
      return assign({}, this.state);

    const data = {} as BunchOf<any>;

    select = this.select(select);
    
    for(const key of select)
      data[key] = (this.subject as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | QueryFunction<this> | BunchOf<any>) => {

    if(typeof select == "string")
      select = [select];
    else if(fn(select))
      select = this.select(select);

    if(Array.isArray(select))
      select.forEach(k => super.emit(k))
    else
      assignSpecific(this.subject, select, Array.from(this.watched));
  }

  public requestUpdate = (
    argument?: RequestCallback | boolean) => {

    const { pending, waiting } = this;

    if(fn(argument))
      waiting.push(argument)
    else if(!pending === argument)
      return Promise.reject(Oops.StrictUpdate())
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}