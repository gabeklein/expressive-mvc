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
type Query = (select: Recursive<{}>) => void;

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
    using: string | Iterable<string> | Query){

    if(typeof using == "string")
      return [ using ];

    if(fn(using))
      return recursiveSelect(using, 
        keys(this.subject).concat(lifecycleEvents)
      );

    return Array.from(using);
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
    select: string | Iterable<string> | Query,
    listener: UpdateCallback<any, any>) => {

    return this.watch(this.select(select), listener);
  }

  public once = (
    select: string | Iterable<string> | Query,
    listener?: UpdateCallback<any, any>) => {

    const target = this.select(select);

    if(listener)
      return this.watch(target, listener, true);
    else 
      return new Promise<void>(resolve => {
        this.addListener(target, () => resolve(), true);
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Query) => {
    
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
    select?: Iterable<string> | Query) => {

    const selected = select
      ? this.select(select)
      : this.watched;

    for(const key of selected)
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    if(!select)
      return assign({}, this.state);

    const data = {} as BunchOf<any>;

    for(const key of this.select(select))
      data[key] = (this.subject as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | Query) => {

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