import { Context } from './context';
import { issues } from './helper/issues';
import { create, define, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,
});

type Observer = (key: string | null | undefined, source: Control) => Callback | null | void;

type InstructionRunner<T extends Model = any> =
  (parent: Control<T>, key: string) => void;

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

  type GetAdapter<T> = (refresh: RequestRefresh, context: Context) => {
    mount: () => (() => void) | void;
    render: () => T;
  } | void;

  type UseAdapter<T extends Model, R> = (refresh: RequestRefresh) => {
    instance: T;
    mount: () => (() => void) | void;
    render: R;
  }

  interface Hooks {
    get: <T> (adapter: GetAdapter<T>) => T | null;
    use: <T extends Model, R>(adapter: UseAdapter<T, R>) => R;
    has: (target: Model) => (callback: (got: Context) => void) => void;
  }
}

const LIFECYCLE = {
  ready: new Set<Control.Callback>(),
  dispatch: new Set<Callback>(),
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>(),
}

class Control<T extends {} = any> {
  static hooks: Control.Hooks;

  static for = control;
  static add = add;

  static on(event: "ready", callback: Control.Callback): Callback;
  static on(event: "update" | "didUpdate", callback: Callback): Callback;
  static on(event: "ready" | "update" | "didUpdate", callback: any){
    LIFECYCLE[event].add(callback);
    return () => {
      LIFECYCLE[event].delete(callback);
    }
  }

  public id: string | number | false;
  public subject: T;

  public state: { [property: string]: unknown } = {};
  public latest?: string[];

  public frame = new Set<string>();
  public followers = new Set<Observer>();
  public observers = new Map([["", this.followers]]);

  constructor(subject: T, id?: string | number | false){
    this.subject = subject;
    this.id = id === undefined ? uid() : id;

    REGISTER.set(subject, this);

    if(id !== false)
      PENDING.set(this, new Set(LIFECYCLE.ready));
  }

  init(){
    const { state, subject } = this;

    for(const key in subject){  
      const { value } = getOwnPropertyDescriptor(subject, key)!;
      const instruction = INSTRUCT.get(value);

      if(instruction){
        INSTRUCT.delete(value);
        instruction(this, key);
      }
      else if(value instanceof Model){
        const set = (next: Model | undefined) => {
          if(!(next instanceof value.constructor))
            throw Oops.BadAssignment(`${subject}.${key}`, value.constructor, next);

          state[key] = next;
          parent(next, subject);
          control(next, true);
          return true;
        }

        this.watch(key, { set });
        set(value);
      }
      else
        this.watch(key, { value });
    }
  }

  watch(key: string, output: Control.PropertyDescriptor<any>){
    const { state } = this;
    const { set, enumerable = true } = output;

    const subs = new Set<Observer>();
    
    this.observers.set(key, subs);

    if("value" in output)
      state[key] = output.value;

    define(this.subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : this.ref(key, set),
      get(this: Model){
        const extend = watch(this, key);

        const value = output.get
          ? output.get(this)
          : state[key];

        return extend(value);
      }
    });
  }

  ref(key: string, callback?: (this: {}, value: unknown) => boolean | void){
    return (value: any) => {
      if(value !== this.state[key])
        switch(callback && callback.call(this.subject, value)){
          case undefined:
            this.state[key] = value;
          case true:
            this.update(key);
        }
    }
  }

  update(key: string){
    const { frame, followers } = this;

    if(!frame.size){
      this.latest = undefined;

      enqueue(() => {
        this.latest = Array.from(frame);
        followers.forEach(cb => {
          const notify = cb(undefined, this);

          if(notify)
            enqueue(notify);
        })
        frame.clear();
      })
    }
  
    frame.add(key);

    for(const subs of [
      this.observers.get(key),
      this.followers
    ])
      subs && subs.forEach(cb => {
        const notify = cb(key, this);
  
        if(notify === null)
          subs.delete(cb);
        else if(notify)
          enqueue(notify);
      });
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
    if(pending){
      let done: Callback | void;
      pending.add(() => done = ready(control));
      return () => done && done();
    }

    return ready(control);
  }

  if(pending && ready){
    control.init();
    PENDING.delete(control);
    pending.forEach(cb => cb(control));
  }

  return control;
}

function enqueue(event: Callback){
  const { update, didUpdate, dispatch } = LIFECYCLE;

  if(!dispatch.size)
    setTimeout(() => {
      update.forEach(x => x());
      dispatch.forEach(event => {
        try {
          event();
        }
        catch(err){
          console.error(err);
        }
      });
      dispatch.clear();
      didUpdate.forEach(x => x());
    }, 0);

  dispatch.add(event);
}

function parent(child: unknown, assign?: {}){
  if(!assign)
    return PARENTS.get(child as Model);

  PARENTS.set(child as Model, assign as Model);
}

function watch<T extends {}>(target: T, key: string): (value: unknown) => any;
function watch<T extends {}>(target: T, callback: Observer): T;
function watch<T extends {}>(value: T, argument: Observer | string){
  const observer = OBSERVER.get(value);
  const control = REGISTER.get(value)!;

  if(typeof argument == "string"){
    const subs = control.observers.get(argument)!;

    if(observer)
      subs.add(observer);

    return (value: {}): any => (
      observer && REGISTER.has(value)
        ? watch(value, observer)
        : value
    )
  }

  if(!observer)
    REGISTER.set(value = create(value), control);

  OBSERVER.set(value, argument);

  return value;
}

function add<T = any>(instruction: Control.Instruction<T>){
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

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  add,
  control,
  Control,
  parent,
  uid,
  watch
}