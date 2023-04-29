import { issues } from './helper/issues';
import { defineProperty, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`
});

type Observer = (key: string | null, from: Control) => Callback | null | void;
type InstructionRunner = (key: string, controller: Control) => void;

const INSTRUCT = new Map<symbol, InstructionRunner>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();

const Dispatch = new class Dispatch {
  after = new Set<Callback>();
  before = new Set<Callback>();
  waiting = new Set<Callback>();

  add(event: Callback){
    const { after, before, waiting } = this;

    if(!waiting.size)
      setTimeout(() => {
        before.forEach(x => x());
        waiting.forEach(notify => {
          try {
            notify();
          }
          catch(err){
            console.error(err);
          }
        });
        waiting.clear();
        after.forEach(x => x());
      }, 0);
  
    waiting.add(event);
  }
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
  public latest?: Model.Event<T>[];
  public parent?: Model;

  public frame = new Set<string>();
  public waiting = new Set<Callback>();
  public followers = new Set<Control.OnSync>();
  public observers = new Map<string | undefined | null, Set<Observer>>();

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

      Dispatch.add(() => {
        this.latest = Array.from(frame);
        this.update("");
        frame.clear();
      })
    }
  
    frame.add(key);

    const dispatch = (
      cb: Observer, _cb: Observer, subs: Set<Observer>) => {

      const notify = cb(key, this);

      if(notify === null)
        subs.delete(cb);
      else if(notify)
        Dispatch.add(notify);
    }

    const subs = this.observers.get(key);

    if(subs)
      subs.forEach(dispatch)

    this.followers.forEach(dispatch);
  }

  addListener(fn: Control.OnSync<any>){
    this.followers.add(fn);
    return () => this.followers.delete(fn);
  }

  clear(){
    this.followers.forEach(x => x(null, this));
    this.followers.clear();

    this.observers.forEach(subs => {
      subs.forEach(fn => fn(null, this));
    });
    this.observers.clear();
  }

  static get = controls;
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

function controls<T extends Model>(from: T): Control<T> {
  return REGISTER.get(from.is) || new Control(from.is);
}

function control<T extends Model>(subject: T): Control<T>;
function control<T extends Model>(subject: T, cb: control.OnReady<T>): Callback;
function control<T extends Model>(subject: T, cb?: control.OnReady<T>){
  const control = controls(subject);

  if(cb){
    if(control.state)
      return cb(control);

    let callback: Callback | void;

    control.waiting.add(() => {
      callback = cb(control);
    });

    return () => callback && callback();
  }

  if(!control.state){
    control.state = new Map();

    for(const key in control.subject)
      control.add(key);

    control.waiting.forEach(cb => cb());
  }

  return control;
}

function setRecursive(
  on: Control, key: string, value: Model){

  const set = (next: Model | undefined) => {
    if(next instanceof value.constructor){
      on.state.set(key, next);
      controls(next).parent = on.subject;
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, value.constructor, next);
  }

  on.watch(key, { set });
  set(value);
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

/** Random alphanumberic of length 6; will always start with a letter. */
function random(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  Dispatch,
  control,
  Control,
  controls,
  detect,
  INSTRUCT,
  observer,
}