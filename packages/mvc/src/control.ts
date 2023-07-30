import { Context } from './context';
import { create, define, getOwnPropertyDescriptor, keys } from './helper/object';
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

  type OnUpdate<T extends {} = any> =
    (key: Model.Key<T> | null | undefined, source: Control<T>) => (() => void) | null | void;

  type OnChange = (this: {}, next: unknown, previous: unknown) => boolean | void;
}

const LIFECYCLE = {
  ready: new Set<Control.Callback>(),
  dispatch: new Set<Callback>(),
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>(),
}

const OBSERVERS = new WeakMap<{}, Set<Control.OnUpdate>>();
export const ID = new WeakMap<{}, string | number | false>();

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

  public subject: T;

  public state: { [property: string]: unknown } = {};
  public frame: { [property: string]: unknown } = {};
  public latest?: { [property: string]: unknown };

  public observers = new Map<string, Set<Control.OnUpdate>>();

  constructor(subject: T, id?: string | number | false){
    const followers = new Set<Control.OnUpdate>();

    this.subject = subject;
    this.observers.set("", followers);

    ID.set(subject, id === undefined ? uid() : id);

    OBSERVERS.set(subject, followers);
    REGISTER.set(subject, this);

    if(id !== false)
      PENDING.set(this, new Set(LIFECYCLE.ready));
  }

  watch(key: string, output: Control.PropertyDescriptor<any>){
    const { state } = this;
    const { set, enumerable = true } = output;

    const subs = new Set<Control.OnUpdate>();

    this.observers.set(key, subs);

    if("value" in output)
      state[key] = output.value;

    define(this.subject, key, {
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
    const { frame, observers, state } = this;
    const any = observers.get("");

    if(!any)
      return;

    const own = observers.get(key);

    if(!own){
      state[key] = undefined;
      observers.set(key, new Set());
      return;
    }

    if(!keys(frame).length){
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

    frame[key] = state[key];

    for(const subs of [own, any])
      for(const cb of subs){
        const notify = cb(key, this);
    
        if(notify === null)
          subs.delete(cb);
        else if(notify)
          enqueue(notify);
      }
  }

  ref(key: string, callback?: Control.OnChange){
    return (next: any) => {
      const previous = this.state[key];

      switch(
        next !== previous &&
        callback &&
        callback.call(this.subject, next, previous)
      ){
        case undefined:
          this.state[key] = next;
        case true:
          this.update(key);
      }
    }
  }
}

function addListener<T extends Model>(subject: T, fn: Control.OnUpdate<T>){
  const any = OBSERVERS.get(subject.is)!;
  any.add(fn);
  return () => any.delete(fn);
}

function clear(subject: Model){
  const self = REGISTER.get(subject)!;
  const notify = (subs: Set<Control.OnUpdate>) => {
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

        const desc = instruction.call(self, key, self);
      
        if(desc)
          self.watch(key, typeof desc == "object" ? desc : { get: desc });
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

function watch<T extends {}>(value: T, argument: Control.OnUpdate){
  const control = REGISTER.get(value)!;

  if(!OBSERVER.has(value))
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