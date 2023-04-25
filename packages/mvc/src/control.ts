import { setRecursive } from './children';
import { defineProperty, getOwnPropertyDescriptor, random } from './helper/object';
import { setInstruction } from './instruction/add';
import { flushComputed } from './instruction/get';
import { Model } from './model';
import { suspend } from './suspense';

import type { Callback } from '../types';

export type Observer = (key: string | null, from: Control) => Callback | null | void;

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();

export function observer<T extends Model>(from: T){
  return OBSERVER.get(from);
}

export function detect<T extends Model>(
  on: T, cb: Observer): T {

  if(!on.hasOwnProperty("is"))
    on = defineProperty(Object.create(on), "is", { value: on });

  OBSERVER.set(on, cb);

  return on;
}

function flushEvents(on: Control){
  const { frame, waiting } = on;
  const keys = on.latest = Array.from(frame);

  setTimeout(() => on.latest = undefined, 0);
  frame.clear();

  waiting.forEach(notify => {
    waiting.delete(notify);

    try {
      notify(keys);
    }
    catch(err){
      console.error(err);
    }
  })
}

declare namespace Control {
  /**
   * Called immediately when any key is changed or emitted.
   * Returned callback is notified when update is complete.
   */
  type OnSync<T = any> = (key: Model.Event<T> | null, source: Control) => OnAsync<T> | void;

  /** Called at the end of an event frame with all keys affected. */
  type OnAsync<T = any> = (keys: Model.Event<T>[]) => void;

  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
  
  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T> = (this: Control, key: string, thisArg: Control) =>
    | PropertyDescriptor<T>
    | Getter<T>
    | void;

  type Getter<T> = (source: Model) => T;
    type Setter<T> = (value: T) => boolean | void;

  type PropertyDescriptor<T = any> = {
      enumerable?: boolean;
      value?: T;
      get?: Getter<T>;
      set?: Setter<T> | false;
  }
}

class Control<T extends Model = any> {
  public state!: Map<any, any>;
  public frame = new Set<string>();
  public waiting = new Set<Control.OnAsync<T>>();
  public followers = new Set<Control.OnSync>();
  public latest?: Model.Event<T>[];
  public observers = new Map<string, Set<Observer>>();

  constructor(
    public subject: T,
    public id: string | number = random()){

    REGISTER.set(subject, this);
  }

  init(){
    const { subject } = this;
    
    this.state = new Map();

    for(const key in subject){
      const { value } = getOwnPropertyDescriptor(subject, key)!;
  
      if(typeof value == "function")
        continue;
  
      const output =
        typeof value == "symbol" ?
          setInstruction(this, key, value) :
        value instanceof Model ?
          setRecursive(this, key, value) :
        { value };

      if(!output)
        continue;

      if("value" in output)
        this.state.set(key, output.value);

      this.watch(key, output);
    }
  }

  watch(
    key: keyof T & string,
    output: Control.PropertyDescriptor<any>){

    const { state } = this;
    const { get, set, enumerable } = output;
    const subs = new Set<Observer>();
    
    this.observers.set(key, subs);

    defineProperty(this.subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : this.ref(key as Model.Key<T>, set),
      get(this: any){
        const event = observer(this);

        if(event)
          subs.add(event);

        return get
          ? get(this)
          : state.get(key);
      }
    });
  }

  /** Throw suspense which resolves when key is set. */
  waitFor(key: string): never {
    throw suspend(this, key);
  }

  addListener(listener: Control.OnSync<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  ref<K extends Model.Key<T>>(
    key: K, cb?: (this: T, value: T[K]) => boolean | void){

    const { state, subject } = this
  
    return (value: any) => {
      if(value === state.get(key))
        return;

      switch(cb && cb.call(subject, value)){
        case undefined:
          state.set(key, value);
        case true:
          this.update(key);
      }
    }
  }

  update(key: string){
    const { followers, frame, waiting } = this;

    if(frame.has(key))
      return;
  
    if(!frame.size)
      setTimeout(() => {
        flushComputed(this);  
        flushEvents(this);
      }, 0);
  
    frame.add(key);

    const subs = this.observers.get(key);

    if(subs)
      for(const callback of subs){
        const notify = callback(key, this);

        if(notify === null)
          subs.delete(callback);
        else if(notify)
          waiting.add(notify);
      }
  
    for(const callback of followers){
      const event = callback(key, this);
  
      if(typeof event == "function")
        waiting.add(event);
    }
  }

  clear(){
    const listeners = [ ...this.followers ];

    this.followers.clear();
    listeners.forEach(x => x(null, this));
  }

  static get = controller;
  static for = control;
  static sub = detect;
}

function controller<T extends Model>(from: T){
  if("is" in from)
    from = from.is;

  return REGISTER.get(from) as Control<T> | undefined;
}

declare namespace control {
  /**
   * Callback for Controller.for() static method.
   * Returned callback is forwarded.
   */
  type OnReady<T extends Model> = (control: Control<T>) => Callback | void;
}

function control<T extends Model>(subject: T): Control<T>;
function control<T extends Model>(subject: T, cb: control.OnReady<T>): Callback;
function control<T extends Model>(subject: T, cb?: control.OnReady<T>){
  const control = controller(subject) || new Control(subject);

  if(!control.state){
    const { waiting } = control;

    if(cb){
      let callback: Callback | void;

      waiting.add(() => {
        callback = cb(control);
      });

      return () => {
        if(callback)
          callback();
      }
    }

    control.init();
    control.waiting = new Set();

    for(const cb of waiting)
      cb([]);
  }

  return cb ? cb(control) : control;
}

export {
  Control,
  control,
  controller
}