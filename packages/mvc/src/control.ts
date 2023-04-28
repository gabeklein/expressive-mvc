import { setRecursive } from './children';
import { defineProperty, getOwnPropertyDescriptor, random } from './helper/object';
import { flushComputed } from './instruction/get';
import { Model } from './model';

import type { Callback } from '../types';

export type Observer = (key: string | null, from: Control) => (() => void) | null | void;

type InstructionRunner = (key: string, controller: Control) => void;

const FACTORY = new Map<symbol, InstructionRunner>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();
const WAITING = new Set<Callback>();

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
  public observers = new Map<string | undefined | null, Set<Observer>>();

  constructor(
    public subject: T,
    public id: string | number = random()){

    REGISTER.set(subject, this);
  }

  add(key: Extract<keyof T, string>){
    const { value } = getOwnPropertyDescriptor(this.subject, key)!;
    const instruction = FACTORY.get(value);

    if(typeof instruction == "function"){
      FACTORY.delete(value);
      instruction(key, this);
    }
    else if(value instanceof Model)
      setRecursive(this, key, value);
    else if(typeof value != "function")
      this.watch(key, { value });
  }

  watch(
    key: keyof T & string,
    output: Control.PropertyDescriptor<any>){

    const { state } = this;
    const { get, set, enumerable } = output;

    const subs = new Set<Observer>();
    
    this.observers.set(key, subs);

    if("value" in output)
      state.set(key, output.value);

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
    const { frame } = this;

    if(frame.has(key))
      return;
  
    if(!frame.size){
      this.latest = undefined;

      setPending(() => {
        flushComputed(this);
        this.latest = Array.from(frame);
        this.update("");
        frame.clear();
      })
    }
  
    frame.add(key);

    const dispatch = (
      callback: Observer,
      callback2: Observer,
      subs: Set<Observer>) => {

        const notify = callback(key, this);

        // TODO: Is this necessary?
        if(notify === null)
          subs.delete(callback);
        else if(notify)
          WAITING.add(notify);
      }
  
    const subs = this.observers.get(key);

    if(subs)
      subs.forEach(dispatch)
  
    this.followers.forEach(dispatch);
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
    
    control.state = new Map();

    for(const key in control.subject)
      control.add(key);

    for(const callback of waiting)
      callback();
  }

  return cb ? cb(control) : control;
}

function controller<T extends Model>(from: T){
  return REGISTER.get(from.is) as Control<T> | undefined;
}

function setPending(event: Callback, passive?: boolean){
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

function observer<T extends Model>(from: T){
  return OBSERVER.get(from);
}

function detect<T extends Model>(on: T, cb: Observer): T {
  if(!on.hasOwnProperty("is"))
    on = defineProperty(Object.create(on), "is", { value: on });

  OBSERVER.set(on, cb);

  return on;
}

export {
  control,
  Control,
  controller,
  detect,
  FACTORY,
  observer,
  setPending,
}