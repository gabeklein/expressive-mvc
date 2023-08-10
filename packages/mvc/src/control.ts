import { assign, create, define, freeze, getOwnPropertyDescriptor, isFrozen } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();
const INSTRUCT = new Map<symbol, Control.Instruction<any>>();
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
  type Setter<T> = (value: T, previous: T) => boolean | void;

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

  type OnUpdate<T extends {} = any> =
    (key: Model.Key<T> | null | undefined, source: T) => (() => void) | null | void;

  type OnChange = (this: {}, next: unknown, previous: unknown) => boolean | void;
}

const LIFECYCLE = {
  ready: new Set<Control.Callback>(),
  dispatch: new Set<Callback>(),
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>(),
}

class Control<T extends {} = any> {
  static watch = watch;
  static for = control;
  static add = add;

  static on(event: "ready", callback: Control.Callback): Callback;
  static on(event: "update" | "didUpdate", callback: Callback): Callback;
  static on(event: "ready" | "update" | "didUpdate", callback: any){
    LIFECYCLE[event].add(callback);
    return () => LIFECYCLE[event].delete(callback);
  }

  public id: string;
  public state: { [property: string]: unknown } = {};
  public frame: { [property: string]: unknown } = freeze({});

  public listeners: Map<Control.OnUpdate, Set<string> | undefined> | undefined = new Map();

  constructor(public subject: T, id?: string | number | false){
    this.id = `${subject.constructor}-${id ? String(id) : uid()}`;

    REGISTER.set(subject, this);

    if(id !== false)
      PENDING.set(this, new Set(LIFECYCLE.ready));
  }

  watch(key: string, output: Control.PropertyDescriptor<any>){
    const self = this;
    const { state, subject } = this;
    const { set, enumerable = true } = output;

    if("value" in output)
      state[key] = output.value;

    define(subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : (next) => {
          const previous = state[key];
    
          if(next !== previous){
            state[key] = next;
      
            if(set && set.call(subject, next, previous) === false)
              state[key] = previous;
            else
              this.update(key);
          }
        },
      get(this: Model){
        const observer = OBSERVER.get(this);

        if(observer)
          self.addListener(observer, key);

        const value = output.get
          ? output.get(this)
          : state[key];

        return observer ? watch(value, observer) : value;
      }
    });
  }

  update(key: string, value?: unknown){
    const { state, subject, listeners } = this;

    if(!listeners || 1 in arguments && value === state[key])
      return;

    if(isFrozen(this.frame)){
      this.frame = {};

      enqueue(() => {
        freeze(this.frame);

        listeners.forEach((subs, cb) => {
          if(!subs){
            const notify = cb(undefined, subject);
  
            if(notify)
              enqueue(notify);
          }
        });
      })
    }

    if(1 in arguments)
      state[key] = value;

    if(key in this.frame)
      return;
    
    this.frame[key] = state[key];

    for(const [cb, keys] of listeners)
      if(!keys || keys.has(key)){
        const notify = cb(key, subject);
    
        if(notify === null)
          listeners.delete(cb);
        else if(notify)
          enqueue(notify);
      }
  }

  fetch(key: string, required?: boolean){
    const { state, subject } = this;

    return () => {
      if(key in state || required === false){
        const value = state[key];

        if(value !== undefined || !required)
          return value;
      }

      const error = new Error(`${subject}.${key} is not yet available.`);
      const promise = new Promise<void>((resolve, reject) => {
        function check(){
          if(state[key] !== undefined){
            remove();
            resolve();
          }
        }
    
        const remove = this.addListener((k: unknown) => {
          if(k === key)
            return check;
    
          if(k === null)
            reject(new Error(`${subject} is destroyed.`));
        });
      });
    
      throw assign(promise, {
        toString: () => String(error),
        name: "Suspense",
        message: error.message,
        stack: error.stack
      });
    }
  }

  addListener<T extends Model>(
    fn: Control.OnUpdate<T>, key?: string){

    const { listeners } = this;

    if(!listeners)
      throw new Error("Model is destroyed.");

    let keys = listeners.get(fn);

    if(key){
      if(!keys)
        keys = new Set();

      keys.add(key);
    }

    listeners.set(fn, keys);
    return () => listeners.delete(fn);
  }

  clear(){
    const { listeners } = this;

    if(listeners){
      this.listeners = undefined;
      listeners.forEach((_, fn) => {
        const cb = fn(null, this);
        cb && cb();
      });
    }
  }
}

function control<T extends Model>(subject: T, ready: Control.OnReady<T>): Callback;
function control<T extends Model>(subject: T, ready?: boolean): Control<T>;
function control<T extends Model>(subject: T, ready?: boolean | Control.OnReady<T>){
  const self = REGISTER.get(subject.is) as Control<T>;
  const pending = PENDING.get(self);

  if(typeof ready == "function"){
    if(pending){
      let done: Callback | void;
      pending.add(() => done = ready(self));
      return () => done && done();
    }

    return ready(self);
  }

  if(pending && ready){
    for(const key in subject){
      const { value } = getOwnPropertyDescriptor(subject, key)!;
      const instruction = INSTRUCT.get(value);
      let desc: Control.PropertyDescriptor<unknown> | void = { value };

      if(instruction){
        INSTRUCT.delete(value);
        delete subject[key];

        const out = instruction.call(self, key, self);
        desc = typeof out == "function" ? { get: out } : out;
      }

      if(desc)
        self.watch(key, desc);
    }
    
    PENDING.delete(self);
    pending.forEach(cb => cb(self));
  }

  return self;
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

function parent(from: unknown, assign?: {}){
  if(!assign)
    return PARENTS.get(from as Model);

  PARENTS.set(from as Model, assign as Model);
}

function watch<T extends {}>(value: T, argument: Control.OnUpdate){
  const control = REGISTER.get(value);

  if(control){
    if(!OBSERVER.has(value))
      REGISTER.set(value = create(value), control);
  
    OBSERVER.set(value, argument);
  }

  return value;
}

function add<T = any>(instruction: Control.Instruction<T>){
  const placeholder = Symbol("instruction");
  INSTRUCT.set(placeholder, instruction);
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