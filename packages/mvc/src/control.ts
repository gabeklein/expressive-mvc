import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,

  NoAdapter: (method) =>
    `Can't call Model.${method} without an adapter.`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}.`
});

type Observer<T extends Model = any> =
  (key: Model.Event<T> | null | undefined, source: Control) => Callback | null | void;

type InstructionRunner<T extends Model = any> =
  (key: Model.Key<T>, parent: Control<T>) => void;

const INSTRUCTION = new Map<symbol, InstructionRunner>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();

declare namespace Control {
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

  /**
   * Callback for Controller.for() static method.
   * Returned callback is forwarded.
   */
  type OnReady<T extends Model> = (control: Control<T>) => Callback | void;

  type GetAdapter<T> = (update: () => void) => {
    commit: () => (() => void) | void;
    render: () => T;
  } | void;

  type GetHook = <T> (
    factory: GetAdapter<T>
  ) => T | null;

  type UseAdapter<T extends Model> = (update: () => void) => {
    instance: T;
    commit: () => (() => void) | void;
    render: (props: Model.Compat<T>) => T;
  }

  type UseHook = <T extends Model>(
    factory: UseAdapter<T>,
    props: Model.Compat<T>
  ) => T;

  type HasHook = {
    <T extends Model> (
      type: Model.Class<T>,
      required?: false,
      relativeTo?: Model
    ): (callback: (got: T | undefined) => void) => void;
    
    <T extends Model> (
      type: Model.Class<T>,
      required?: boolean,
      relativeTo?: Model
    ): (callback: (got: T) => void) => void;
  }
}

class Control<T extends Model = any> {
  static after = new Set<Callback>();
  static before = new Set<Callback>();
  static pending = new Set<Callback>();

  static getModel: Control.GetHook;
  static newModel: Control.UseHook;
  static hasModel: Control.HasHook = fetch;

  static for = control;
  static apply = apply;
  static watch = watch;

  public parent?: Model;
  public state!: { [key: string]: any };

  // TODO: make Partial this
  public latest?: Model.Event<T>[];

  public frame = new Set<string>();
  public followers = new Set<Observer>();
  public observers = new Map([["", this.followers]]);

  constructor(
    public subject: T,
    public id: string | number = random()){

    REGISTER.set(subject, this);
  }

  add(key: Extract<keyof T, string>){
    const { value } = getOwnPropertyDescriptor(this.subject, key)!;
    const instruction = INSTRUCTION.get(value);

    if(typeof instruction == "function"){
      INSTRUCTION.delete(value);
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
    key: K, callback?: (this: T, value: T[K]) => boolean | void){

    const { state, subject } = this
  
    return (value: any) => {
      if(value !== state[key])
        switch(callback && callback.call(subject, value)){
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

      subs && subs.forEach(cb => {
        const notify = cb(key, this);
  
        if(notify === null)
          subs.delete(cb);
        else if(notify)
          requestUpdateFrame(notify);
      });
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

const PENDING_INIT = new WeakMap<Control, Set<Callback>>();

function control<T extends Model>(subject: T, ready: Control.OnReady<T>): Callback;
function control<T extends Model>(subject: T, ready?: boolean): Control<T>;
function control<T extends Model>(subject: T, ready?: boolean | Control.OnReady<T>){
  const control = REGISTER.get(subject.is) as Control<T>;
  const onReady = typeof ready == "function" && ready;

  if(!control.state && ready){
    let waiting = PENDING_INIT.get(control);

    if(!waiting)
      PENDING_INIT.set(control, waiting = new Set());

    if(onReady){
      let callback: Callback | void;
  
      waiting.add(() => callback = onReady(control));
  
      return () => callback && callback();
    }

    control.state = {};

    for(const key in control.subject)
      control.add(key);

    waiting.forEach(cb => cb());
  }

  return onReady ? onReady(control) : control;
}

function requestUpdateFrame(event: Callback){
  const { after, before, pending } = Control;

  if(!pending.size)
    setTimeout(() => {
      before.forEach(x => x());
      pending.forEach(notify => {
        try {
          notify();
        }
        catch(err){
          console.error(err);
        }
      });
      pending.clear();
      after.forEach(x => x());
    }, 0);

  pending.add(event);
}

function setRecursive(on: Control, key: string, value: Model){
  const set = (next: Model | undefined) => {
    if(next instanceof value.constructor){
      on.state[key] = next;
      control(next).parent = on.subject;
      control(next, true);
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

function apply<T = any>(instruction: Control.Instruction<any>){
  const placeholder = Symbol("instruction");

  INSTRUCTION.set(placeholder, (key, onto) => {
    delete onto.subject[key];
  
    const output = instruction.call(onto, key, onto);
  
    if(output)
      onto.watch(key, 
        typeof output == "function" ? { get: output } : output
      );
  });

  return placeholder as unknown as T;
}

function fetch <T extends Model>(
  type: Model.Class<T>,
  required?: false,
  relativeTo?: Model
): (callback: (got: T | undefined) => void) => void;

function fetch <T extends Model>(
  type: Model.Class<T>,
  required?: boolean,
  relativeTo?: Model
): (callback: (got: T) => void) => void;

/** Placeholder fetch - overridden by adapter. */
function fetch(type: Model.Type, required?: boolean, relativeTo?: Model): any {
  if(!relativeTo)
    throw Oops.NoAdapter("has");

  if(required)
    throw Oops.Required(type, relativeTo.constructor);
}

/** Random alphanumberic of length 6; will always start with a letter. */
function random(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  apply,
  control,
  Control,
  watch
}