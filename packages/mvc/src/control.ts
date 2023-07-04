import { Context } from './context';
import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,
});

type Observer<T extends Model = any> =
  (key: Model.Event<T> | null | undefined, source: Control) => Callback | null | void;

type InstructionRunner<T extends Model = any> =
  (parent: Control<T>, key: Model.Key<T>) => void;

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();
const INSTRUCT = new Map<symbol, InstructionRunner>();
const PENDING = new WeakMap<Control, Set<Control.Callback>>();
const PARENTS = new WeakMap<Model, Model>();

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
    get?: Getter<T>;
    set?: Setter<T> | false;
    enumerable?: boolean;
    value?: T;
  }

  type Callback = (control: Control) => void;

  /**
   * Callback for Controller.for() static method.
   * Returned callback is forwarded.
   */
  type OnReady<T extends {}> = (control: Control<T>) => (() => void) | void;

  type RequestRefresh = (update: (tick: number) => number) => void;

  type GetContext = (target: Model) =>
    (callback: (got: Context) => void) => void;

  type GetAdapter<T> = (
    refresh: RequestRefresh,
    context: Context
  ) => {
    mount: () => (() => void) | void;
    render: () => T;
  } | void;

  type GetHook = <T> (adapter: GetAdapter<T>) => T | null;

  type UseAdapter<T extends Model, R> = (
    refresh: RequestRefresh
  ) => {
    instance: T;
    mount: () => (() => void) | void;
    render: R;
  }

  type UseHook = <T extends Model, R>
    (adapter: UseAdapter<T, R>) => R;
}

class Control<T extends {} = any> {
  static ready = new Set<Control.Callback>();
  static after = new Set<Callback>();
  static before = new Set<Callback>();
  static pending = new Set<Callback>();

  static get: Control.GetHook;
  static use: Control.UseHook;
  static has: Control.GetContext;

  static for = control;
  static apply = apply;
  static watch = watch;

  public id: string | number | false;
  public subject: T;

  public state: { [key: string]: any } = {};
  public latest?: Model.Event<T>[];

  public frame = new Set<string>();
  public followers = new Set<Observer>();
  public observers = new Map([["", this.followers]]);

  constructor(subject: T, id: string | number | false){
    this.id = id;
    this.subject = subject;
    REGISTER.set(subject, this);

    if(id !== false)
      PENDING.set(this, new Set(Control.ready));
  }

  add(key: string){
    const { value } = getOwnPropertyDescriptor(this.subject, key)!;
    const instruction = INSTRUCT.get(value);

    if(typeof instruction == "function"){
      INSTRUCT.delete(value);
      instruction(this, key);
    }
    else if(value instanceof Model)
      setRecursive(this, key, value);
    else
      this.watch(key, { value });
  }

  watch(
    key: string,
    output: Control.PropertyDescriptor<any>){

    const { state } = this;
    const { set, enumerable = true } = output;

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

        const value = output.get
          ? output.get(this) : state[key];

        return event && REGISTER.has(value)
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

function control<T extends Model>(subject: T, ready: Control.OnReady<T>): Callback;
function control<T extends Model>(subject: T, ready?: boolean): Control<T>;
function control<T extends Model>(subject: T, ready?: boolean | Control.OnReady<T>){
  const control = REGISTER.get(subject) as Control<T>;
  const pending = PENDING.get(control);

  if(typeof ready == "function"){
    if(!pending)
      return ready(control);

    let done: Callback | void;
    pending.add(() => done = ready(control));
    return () => done && done();
  }

  if(pending && ready){
    for(const key in control.subject)
      control.add(key);

    PENDING.delete(control);
    pending.forEach(cb => cb(control));
  }

  return control;
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
      parent(next, on.subject);
      control(next, true);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, value.constructor, next);
  }

  on.watch(key, { set });
  set(value);
}

function parent(child: unknown, assign?: Model){
  if(!assign)
    return PARENTS.get(child as Model);

  PARENTS.set(child as Model, assign);
}

type Focus<T extends {}> = T & { is: T };

function watch<T extends {}>(value: T, cb: Observer){
  if(!OBSERVER.has(value)){
    const control = REGISTER.get(value);
    value = defineProperty(create(value), "is", { value });
    REGISTER.set(value, control!);
  }

  OBSERVER.set(value, cb);

  return value as Focus<T>;
}

function apply<T = any>(instruction: Control.Instruction<T>){
  const placeholder = Symbol("instruction");

  INSTRUCT.set(placeholder, (onto, key) => {
    delete onto.subject[key];
  
    const output = instruction.call(onto, key, onto);
  
    if(output)
      onto.watch(key, 
        typeof output == "function" ? { get: output } : output
      );
  });

  return placeholder as unknown as T;
}

export {
  apply,
  control,
  Control,
  parent,
  watch
}