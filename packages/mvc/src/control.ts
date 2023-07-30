import { Context } from './context';
import { issues } from './helper/issues';
import { create, define, getOwnPropertyDescriptor } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,
});

type Observer<T extends {} = any> =
  (key: Model.Key<T> | null | undefined, source: Control<T>) => Callback | null | void;

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Observer>();
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

const OBSERVERS = new WeakMap<{}, Set<Observer>>();

class Control<T extends {} = any> {
  static hooks: Control.Hooks;
  static for = control;
  static add = add;

  static on(event: "ready", callback: Control.Callback): Callback;
  static on(event: "update" | "didUpdate", callback: Callback): Callback;
  static on(event: "ready" | "update" | "didUpdate", callback: any){
    LIFECYCLE[event].add(callback);
    return () =>
      LIFECYCLE[event].delete(callback);
  }

  public id: string | number | false;
  public subject: T;

  public state: { [property: string]: unknown } = {};
  public frame: { [property: string]: unknown } = {};
  public latest?: { [property: string]: unknown };

  public observers = new Map<string, Set<Observer>>();

  constructor(subject: T, id?: string | number | false){
    this.subject = subject;
    this.id = id === undefined ? uid() : id;

    const followers = new Set<Observer>();

    OBSERVERS.set(subject, followers);
    REGISTER.set(subject, this);

    this.observers.set("", followers);

    if(id !== false)
      PENDING.set(this, new Set(LIFECYCLE.ready));
  }

  watch(key: string, output: Control.PropertyDescriptor<any>){
    const { state, observers, subject } = this;
    const { set, enumerable = true } = output;

    const subs = new Set<Observer>();

    observers.set(key, subs);

    if("value" in output)
      state[key] = output.value;

    define(subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : this.ref(key, set),
      get(this: Model){
        const observer = OBSERVER.get(this);

        if(observer)
          subs.add(observer);

        const value = output.get
          ? output.get(this)
          : state[key];

        return observer && REGISTER.has(value)
          ? watch(value, observer)
          : value;
      }
    });
  }

  update(key: string){
    const any = this.observers.get("")!;

    if(!any)
      return;

    const { frame } = this;

    if(!frame.size){
      this.latest = undefined;

      enqueue(() => {
        this.latest = { ...frame };

        any.forEach(cb => {
          const notify = cb(undefined, this);

          if(notify)
            enqueue(notify);
        });

        this.frame = {};
      })
    }

    frame[key] = this.state[key];

    for(const subs of [this.observers.get(key), any])
      if(subs)
        for(const cb of subs)
          try {
            const notify = cb(key, this);
      
            if(notify === null)
              subs.delete(cb);
            else if(notify)
              enqueue(notify);
          }
          catch(err){
            console.error(err);
          }
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
}

function addListener<T extends Model>(subject: T, fn: Observer<T>){
  const any = OBSERVERS.get(subject.is)!;
  any.add(fn);
  return () => any.delete(fn);
}

function clear(subject: Model){
  const self = REGISTER.get(subject)!;
  const notify = (subs: Set<Observer>) => {
    subs.forEach(fn => {
      const cb = fn(null, self);
      cb && cb();
    });
  }

  self.observers.forEach(notify);
  self.observers.clear();
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

      if(instruction){
        INSTRUCT.delete(value);
        delete subject[key];

        const output = instruction.call(self, key, self);
      
        if(output)
          self.watch(key, typeof output == "object" ? output : { get: output });
      }
      else if(value instanceof Model){
        const set = (next: Model | undefined) => {
          if(!(next instanceof value.constructor))
            throw Oops.BadAssignment(`${subject}.${key}`, value.constructor, next);

          parent(next, subject);
          control(next, true);
        }

        self.watch(key, { value, set });
        set(value);
      }
      else
        self.watch(key, { value });
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

function parent(child: unknown, assign?: {}){
  if(!assign)
    return PARENTS.get(child as Model);

  PARENTS.set(child as Model, assign as Model);
}

function watch<T extends {}>(value: T, argument: Observer){
  const observer = OBSERVER.get(value);
  const control = REGISTER.get(value)!;

  if(!observer)
    REGISTER.set(value = create(value), control);

  OBSERVER.set(value, argument);

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
  addListener,
  clear,
  control,
  Control,
  parent,
  uid,
  watch
}