import { setRecursive } from './children';
import { defineProperty, getOwnPropertyDescriptor, random } from './helper/object';
import { setInstruction } from './instruction/add';
import { flushComputed } from './instruction/get';
import { Model } from './model';
import { suspend } from './suspense';

import type { Callback } from '../types';

export type Observer = (key: string | null, from: Control) => (() => void) | null | void;

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();

const WAITING = new Set<Callback>();

export function setPending(event: Callback, passive?: boolean){
  if(!WAITING.size && !passive)
    setTimeout(() => {
      WAITING.forEach(notify => {
        try {
          notify();
        }
        catch(err){
          console.error(err);
        }
      });
      WAITING.clear();
    }, 0);

  WAITING.add(event);
}

export function observer<T extends Model>(from: T){
  return OBSERVER.get(from);
}

export function detect<T extends Model>(on: T, cb: Observer): T {
  if(!on.hasOwnProperty("is"))
    on = defineProperty(Object.create(on), "is", { value: on });

  OBSERVER.set(on, cb);

  return on;
}

declare namespace Control {
  /**
   * Called immediately when any key is changed or emitted.
   * Returned callback is notified when update is complete.
   */
  type OnSync<T = any> = (key: Model.Event<T> | null, source: Control) => Callback | void;

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
  public waiting = new Set<Callback>();
  public followers = new Set<Control.OnSync>();
  public latest?: Model.Event<T>[];
  public observers: Map<string | null, Set<Observer>> = new Map([[null, new Set()]]);

  constructor(
    public subject: T,
    public id: string | number = random()){

    REGISTER.set(subject, this);
  }

  init(){
    this.state = new Map();

    for(const key in this.subject){
      const { value } = getOwnPropertyDescriptor(this.subject, key)!;
  
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

        const value = get ? get(this) : state.get(key);

        return event && value instanceof Model
          ? detect(value, event)
          : value;
      }
    });
  }

  /** Throw suspense which resolves when key is set. */
  waitFor(key: string): never {
    throw suspend(this, key);
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
  
    if(!frame.size){
      this.latest = undefined;

      waiting.add(() => {
        flushComputed(this);
        this.latest = Array.from(frame);
        frame.clear();
      })

      setPending(() => {
        waiting.forEach(notify => {
          try {
            notify();
          }
          catch(err){
            console.error(err);
          }
        })
        waiting.clear();
      })
    }
  
    frame.add(key);

    const subs = this.observers.get(key);

    if(subs)
      for(const callback of subs){
        const notify = callback(key, this);

        // TODO: Is this necessary?
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
    this.followers.forEach(x => x(null, this));
    this.followers.clear();

    this.observers.forEach(subs => {
      subs.forEach(fn => fn(null, this));
    });
    this.observers.clear();
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
      cb();
  }

  return cb ? cb(control) : control;
}

export {
  Control,
  control,
  controller
}