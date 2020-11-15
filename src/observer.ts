import type { Observable, UpdateCallback, Selector } from "../";

import { Controller } from './controller';
import { Placeholder } from './directives';
import { Subscriber } from './subscriber';
import {
  assign,
  define,
  defineProperty,
  entriesIn,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  isFn,
  keys,
  listAccess,
  squash,
  within,
} from './util';

import Oops from './issues';

const COMPUTED = Symbol("is_computed");

export class Observer {
  public ready?: true;

  constructor(public subject: Partial<Observable>){
    define(subject, {
      on: this.on,
      once: this.once,
      update: this.update,
      effect: this.effect,
      export: this.export,
      requestUpdate: this.requestUpdate
    })
  }
  
  protected state: BunchOf<any> = {};
  protected subscribers: BunchOf<Set<Callback>> = {};
  protected pending?: Set<string>;
  protected waiting?: ((keys: string[]) => void)[];

  public get values(){
    return assign({}, this.state);
  }

  public get watched(){
    return keys(this.subscribers);
  }

  public on = (
    key: string | Selector<this>,
    listener: UpdateCallback<any, string>) => {

    return this.watch(key, listener, false);
  }

  public once = (
    key: string | Selector<this>,
    listener?: UpdateCallback<any, string>) => {

    if(listener)
      return this.watch(key, listener, true);
    else
      return new Promise(resolve => {
        this.watch(key, resolve, true)
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Selector<this>) => {
    
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
    select?: string[] | Selector<this>) => {

    if(!select)
      return { ...this.values };

    const acc = {} as BunchOf<any>;

    if(isFn(select))
      select = listAccess(this.watched, select);
    
    for(const key of select)
      acc[key] = within(this.subject, key);

    return acc;
  }

  public update = (
    select: string | string[] | Selector<any> | BunchOf<any>,
    ...rest: string[]) => {

    if(typeof select == "string")
      select = [select].concat(rest);

    else if(isFn(select))
      select = listAccess(this.watched, select as any);

    if(Array.isArray(select))
      select.forEach(k => this.emit(k))

    else
      for(const key in select)
        this.set(key, select[key]);
  }

  public requestUpdate = (
    callback?: (keys: string[]) => void) => {

    let listen = this.waiting || (this.waiting = []);

    if(callback)
      listen.push(callback)
    else
      return new Promise(r => listen.push(r));
  }

  private emitUpdate(keys: Iterable<string>){
    const after = this.waiting;

    if(after){
      const list = Array.from(keys);
      this.waiting = undefined;
      after.forEach(x => x(list));
    }
  }

  public set(key: string, value: any){
    let set = this.state;

    if(!(key in this.subscribers))
      set = this.subject;

    if(set[key] === value)
      return false;
    else
      set[key] = value;

    this.emit(key);
    return true;
  }

  public emit(...keys: string[]){
    if(this.pending)
      for(const x of keys)
        this.pending.add(x);
    else {
      const batch = this.pending = new Set(keys);
      setImmediate(() => {
        this.emitSync(batch);
        this.pending = undefined;
      });
    }
  }

  protected emitSync(keys: Iterable<string>){
    const effects = new Set<Callback>();

    for(const k of keys)
      for(const notify of this.subscribers[k] || [])
        if(COMPUTED in notify)
          notify();
        else
          effects.add(notify);

    for(const effect of effects)
        effect();

    this.emitUpdate(keys);
  }

  public addListener(
    key: string,
    callback: Callback,
    once?: boolean){

    const listeners = this.manage(key);
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
    key: string | Selector<any>,
    handler: (value: any, key: string) => void,
    once?: boolean){

    if(isFn(key))
      key = listAccess(this.watched, key)[0];

    const callback = () =>
      handler.call(
        this.subject, 
        this.state[key as string],
        key as string
      );

    return this.addListener(key, callback, once);
  }

  public access(
    key: string,
    callback?: EffectCallback<any>){

    let unSet: Callback | undefined;
    const { state } = this;
      
    state[key] = state[key];
    this.manage(key);

    return {
      get: () => state[key],
      set: (value: any) => {
        if(!this.set(key, value) || !callback)
          return;
  
        unSet && unSet();
        unSet = callback.call(this.subject, value);
  
        if(!isFn(unSet) && unSet)
          throw Oops.BadEffectCallback()
      }
    }
  }

  public monitorValues(ignore: any = {}){
    const entries = entriesIn(this.subject);

    for(const [key, desc] of entries){
      const { value } = desc;

      if(key in ignore
      || "value" in desc == false
      || isFn(value) && !/^[A-Z]/.test(key))
        continue;

      if(value instanceof Placeholder)
        value.applyTo(this, key);
      else
        this.monitorValue(key, value);
    }
  }

  public monitorComputed(Ignore?: Class){
    const { state, subject } = this;
    const getters = {} as BunchOf<() => any>;

    for(
      let sub = subject; 
      sub !== Ignore && sub.constructor !== Ignore;
      sub = getPrototypeOf(sub)
    )
      for(const [key, item] of entriesIn(sub))
        if(!item.get
        || key == "constructor"
        || key in state 
        || key in getters)
          continue;
        else 
          getters[key] = item.get;

    for(const key in getters)
      defineProperty(subject, key, {
        configurable: true,
        get: this.monitorComputedValue(key, getters[key]),
        set: () => {
          throw Oops.AccessNotTracked(key)
        }
      })
  }

  public monitorEvent(
    key: string,
    callback?: EffectCallback<Controller>){

    const fire = () => this.emit(key)

    this.manage(key);
    defineProperty(this.subject, key, {
      get: () => fire,
      set: () => {
        throw Oops.AccessEvent(this.subject.constructor.name, key);
      }
    })

    if(callback)
      this.effect(callback, [key]);
  }

  protected manage(key: string){
    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  public monitorValue(
    key: string,
    initial: any){

    this.state[key] = initial;
    this.manage(key);

    defineProperty(this.subject, key, {
      enumerable: true,
      configurable: false,
      get: () => this.state[key],
      set: (value: any) => this.set(key, value)
    })
  }

  public monitorComputedValue(
    key: string,
    compute: () => any){

    const { state, subject } = this;

    this.manage(key);

    const recalculate = () => {
      const value = compute.call(subject);

      if(value === state[key])
        return;

      state[key] = value;

      this.emit(key);
    }

    const getStartingValue = (early?: boolean) => {
      try {
        const sub = new Subscriber(subject, recalculate);
        const value = state[key] = compute.call(sub.proxy);
        return value;
      }
      catch(e){
        const { name } = this.subject.constructor;

        Oops.ComputeFailed(name, key).warn();
    
        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        defineProperty(subject, key, {
          enumerable: true,
          configurable: true,
          get: () => state[key],
          set: () => {
            throw Oops.AccessNotTracked(key)
          }
        })
      }
    }

    within(recalculate, COMPUTED, true);
    within(getStartingValue, COMPUTED, true);

    return getStartingValue;
  }
}