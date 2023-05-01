import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`
});

type Observer = Control.OnSync;
type InstructionRunner = (key: string, controller: Control) => void;

const INSTRUCT = new Map<symbol, InstructionRunner>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();

declare namespace Control {
  /**
   * Called immediately when any key is changed or emitted.
   * Returned callback is notified when update is complete.
   */
  type OnSync<T = any> = (key: Model.Event<T> | null | undefined, source: Control) => Callback | void | null;

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
  public state!: { [key: string]: any };
  public latest?: Model.Event<T>[];
  public parent?: Model;

  public frame = new Set<string>();
  public followers = new Set<Observer>();
  public observers = new Map([["", this.followers]]);

  static afterUpdate = new Set<Callback>();
  static beforeUpdate = new Set<Callback>();
  static waiting = new Set<Callback>();

  static add = add;
  static get = controls;
  static ready = control;
  static watch = watch;

  constructor(
    public subject: T,
    public id: string | number = random()){

    REGISTER.set(subject, this);
  }

  add(key: Extract<keyof T, string>){
    const { value } = getOwnPropertyDescriptor(this.subject, key)!;
    const instruction = INSTRUCT.get(value);

    if(typeof instruction == "function"){
      INSTRUCT.delete(value);
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
      state[key] = output.value;

    defineProperty(this.subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : this.ref(key as Model.Key<T>, set),
      get(this: any){
        const event = OBSERVER.get(this);

        if(event)
          subs.add(event);

        const value = get ? get(this) : state[key];

        return event && value instanceof Model
          ? watch(value, event)
          : value;
      }
    });
  }

  ref<K extends Model.Key<T>>(
    key: K, cb?: (this: T, value: T[K]) => boolean | void){

    const { state, subject } = this
  
    return (value: any) => {
      if(value !== state[key])
        switch(cb && cb.call(subject, value)){
          case undefined:
            state[key] = value;
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

      requestUpdateFrame(() => {
        this.latest = Array.from(frame);
        this.followers.forEach(cb => {
          const notify = cb(undefined, this);
    
          if(notify)
            requestUpdateFrame(notify);
        })
        frame.clear();
      })
    }
  
    frame.add(key);

    for(const k of ["", key]){
      const subs = this.observers.get(k);

      if(subs)
        for(const cb of subs){
          const notify = cb(key, this);
    
          if(notify === null)
            subs.delete(cb);
          else if(notify)
            requestUpdateFrame(notify);
        }
    }
  }

  addListener(fn: Observer){
    this.followers.add(fn);
    return () => this.followers.delete(fn);
  }

  clear(){
    this.observers.forEach(subs => {
      subs.forEach(fn => {
        const cb = fn(null, this);
        cb && cb();
      });
    });
    this.observers.clear();
  }
}

const WAITING = new WeakMap<Control, Set<Callback>>();

function controls<T extends Model>(from: T){
  return REGISTER.get(from.is) as Control<T>;
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
  const control = controls(subject);

  if(!control.state){
    let waiting = WAITING.get(control);

    if(!waiting)
      WAITING.set(control, waiting = new Set());

    if(cb){
      let callback: Callback | void;
  
      waiting.add(() => callback = cb(control));
  
      return () => callback && callback();
    }

    control.state = {};

    for(const key in control.subject)
      control.add(key);

    waiting.forEach(cb => cb());
  }

  return cb ? cb(control) : control;
}

function requestUpdateFrame(event: Callback){
  const { afterUpdate, beforeUpdate, waiting } = Control;

  if(!waiting.size)
    setTimeout(() => {
      beforeUpdate.forEach(x => x());
      waiting.forEach(notify => {
        try {
          notify();
        }
        catch(err){
          console.error(err);
        }
      });
      waiting.clear();
      afterUpdate.forEach(x => x());
    }, 0);

  waiting.add(event);
}

function setRecursive(
  on: Control, key: string, value: Model){

  const set = (next: Model | undefined) => {
    if(next instanceof value.constructor){
      on.state[key] = next;
      controls(next).parent = on.subject;
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, value.constructor, next);
  }

  on.watch(key, { set });
  set(value);
}

function watch<T extends Model>(on: T, cb: Observer): T {
  if(!on.hasOwnProperty("is"))
    on = defineProperty(create(on), "is", { value: on });

  OBSERVER.set(on, cb);

  return on;
}

function add<T = any>(
  instruction: Control.Instruction<any>){

  const placeholder = Symbol("instruction");

  INSTRUCT.set(placeholder, (key, onto) => {
    delete onto.subject[key];
  
    const output = instruction.call(onto, key, onto);
  
    if(output)
      onto.watch(key, 
        typeof output == "function" ? { get: output } : output
      );
  });

  return placeholder as unknown as T;
}

/** Random alphanumberic of length 6; will always start with a letter. */
function random(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  add,
  control,
  Control,
  controls,
  watch
}