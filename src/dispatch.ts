import type { Controller } from './controller';

import { Pending } from './directives';
import { Observer, COMPUTED } from './observer';
import { Subscriber } from './subscriber';
import {
  defineProperty,
  getOwnPropertyDescriptor,
  isFn,
  listAccess,
  squash,
  within
} from './util';

import Oops from './issues';

const ASSIGNED = new WeakMap<{}, Dispatch>();

export class Dispatch extends Observer {
  public ready?: true;

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
      dispatch.manageProperties();
      dispatch.manageGetters();
  
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
    this.prepare(base);
  }

  public on = (
    key: string | Selector,
    listener: HandleUpdatedValue,
    initial?: boolean) => {

    return this.watch(key, listener, false, initial);
  }

  public once = (
    key: string | Selector,
    listener?: HandleUpdatedValue) => {

    if(listener)
      return this.watch(key, listener, true);
    else
      return new Promise(resolve => {
        this.watch(key, resolve, true)
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Selector) => {
    
    const { subject } = this;
    let unSet: Callback | undefined;

    const reinvoke = squash(() => {
      unSet && unSet();
      unSet = callback.call(subject, subject);

      if(!isFn(unSet) && unSet)
        throw Oops.BadEffectCallback()
    })

    if(!select){
      const sub = new Subscriber(subject, reinvoke);
      unSet = callback.call(sub.proxy, sub.proxy);
      return () => sub.release();
    }
    else {
      if(isFn(select))
        select = listAccess(this.watched, select);

      return this.addMultipleListener(select, reinvoke);
    }
  }

  public export = (
    select?: string[] | Selector) => {

    if(!select)
      return { ...this.state };

    const acc = {} as BunchOf<any>;

    if(isFn(select))
      select = listAccess(this.watched, select);
    
    for(const key of select)
      acc[key] = within(this.subject, key);

    return acc;
  }

  public update = (
    select: string | string[] | Selector | BunchOf<any>,
    ...rest: string[]) => {

    if(typeof select == "string")
      select = [select].concat(rest);
    else if(isFn(select))
      select = listAccess(this.watched, select);

    if(Array.isArray(select))
      select.forEach(k => this.emit(k))
    else
      for(const key in select)
        this.set(key, select[key]);
  }

  public requestUpdate = (
    callback?: boolean | ((keys: string[]) => void)) => {

    let waiting = this.waiting || (this.waiting = []);

    if(typeof callback == "function")
      waiting.push(callback)
    else if(!this.pending === callback)
      return Promise.reject(Oops.StrictUpdate())
    else if(this.pending)
      return new Promise(r => waiting.push(r));
    else
      return Promise.resolve(false);
  }
  
  protected manageProperty(
    key: string, desc: PropertyDescriptor){

    if(desc.value instanceof Pending)
      desc.value.applyTo(this, key);
    else
      super.manageProperty(key, desc);
  }

  public monitorEvent(
    key: string,
    callback?: EffectCallback<Controller>){

    const fire = () => this.emit(key)

    this.monitor(key);
    defineProperty(this.subject, key, {
      get: () => fire,
      set: () => {
        throw Oops.AccessEvent(this.subject.constructor.name, key);
      }
    })

    if(callback)
      this.effect(callback, [key]);
  }

  public addListener(
    key: string,
    callback: Callback,
    once?: boolean){

    const listeners = this.monitor(key);
    const stop = () => { listeners.delete(callback) };
    const onUpdate = once
      ? () => { stop(); callback() }
      : callback;

    const desc = getOwnPropertyDescriptor(this.subject, key);
    const getter = desc && desc.get;
    if(getter && COMPUTED in getter)
      (getter as Function)(true);

    listeners.add(onUpdate);
    return stop;
  }

  public addMultipleListener(
    keys: string[],
    callback: () => void){

    if(keys.length > 2)
      this.addListener(keys[0], callback)

    const update = squash(callback);
    const cleanup = keys.map(k =>
      this.addListener(k, update)
    );

    return () => cleanup.forEach(x => x());
  }

  public watch(
    key: string | Selector,
    handler: (value: any, key: string) => void,
    once?: boolean,
    initial?: boolean){

    if(isFn(key))
      key = listAccess(this.watched, key)[0];

    const callback = () =>
      handler.call(
        this.subject, 
        this.state[key as string],
        key as string
      );

    if(initial)
      callback();

    return this.addListener(key, callback, once);
  }

  public accessor(
    key: string,
    callback?: EffectCallback<any, any>){

    const { state } = this;
    let unSet: Callback | undefined;
      
    state[key] = state[key];
    this.monitor(key);

    return {
      get: () => state[key],
      set: (value: any) => {
        const updated = this.set(key, value);

        if(!updated || !callback)
          return;
  
        unSet && unSet();
        unSet = callback.call(this.subject, value);
  
        if(!isFn(unSet) && unSet)
          throw Oops.BadEffectCallback()
      }
    }
  }
}