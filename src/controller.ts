import { lifecycleEvents } from './lifecycle';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import {
  assign,
  createEffect,
  debounce,
  fn,
  keys,
  recursiveSelect
} from './util';

import Oops from './issues';

type Init = (key: string, on: Controller) => void;

const Register = new WeakMap<{}, Controller>();
const Pending = new WeakSet<Init>();

export class Controller extends Observer {
  static define(fn: Init){
    Pending.add(fn);
    return fn as any;
  }

  static set(on: {}){
    if(Register.has(on))
      return;

    const dispatch = new this(on);

    Register.set(on, dispatch);
    dispatch.prepareComputed();
  
    return dispatch;
  }

  static get(from: {}){
    let dispatch = Register.get(from);

    if(!dispatch)
      throw Oops.NoObserver(from.constructor.name);

    if(!dispatch.ready){
      dispatch.ready = true;
      dispatch.start();
    }

    return dispatch;
  }

  private ready = false;

  protected manageProperty(
    key: string, desc: PropertyDescriptor){

    if(Pending.has(desc.value))
      desc.value(key, this);
    else
      super.manageProperty(key, desc);
  }

  protected select(
    using: string | Iterable<string> | QueryFunction<this>){

    if(typeof using == "string")
      return [ using ];

    if(fn(using))
      return recursiveSelect(using, 
        keys(this.subject).concat(lifecycleEvents)
      );

    return using;
  }

  protected watch(
    key: string | SelectFunction<this>,
    handler: (value: any, key: string) => void,
    once?: boolean,
    initial?: boolean){

    let select: string;

    if(fn(key)){
      const detect = {} as any;
    
      for(const key in this.subject)
        detect[key] = key;
    
      select = key(detect);
    }
    else
      select = key;

    const callback = () => handler.call(
      this.subject, this.state[select], select
    );

    if(initial)
      callback();

    return this.addListener([ select ], callback, once);
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
    property: string | SelectFunction<this>,
    listener: UpdateCallback<any, any>,
    initial?: boolean) => {

    return this.watch(property, listener, false, initial);
  }

  public once = (
    property: string | SelectFunction<this>,
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
    const invoke = debounce(() => effect(subject));

    if(!select){
      let sub: Subscriber;

      const capture = () => {
        sub = new Subscriber(subject, invoke);
        effect(subject = sub.proxy);
        sub.listen();
      }

      if(this.ready)
        capture();
      else
        this.requestUpdate(capture);
      
      return () => sub.release();
    }

    return this.addListener(this.select(select), invoke);
  }

  public import = (
    from: BunchOf<any>,
    select?: Iterable<string> | QueryFunction<this>) => {

    const selected = select
      ? this.select(select)
      : this.watched;

    for(const key of selected)
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | QueryFunction<this>) => {

    if(!select)
      return assign({}, this.state);

    const data = {} as BunchOf<any>;

    for(const key of this.select(select))
      data[key] = (this.subject as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | QueryFunction<this>) => {

    for(const key of this.select(select))
      super.emit(key);
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