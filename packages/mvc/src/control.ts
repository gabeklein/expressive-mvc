import { setRecursive } from './children';
import { defineProperty, getOwnPropertyDescriptor } from './helper/object';
import { Instruction } from './instruction/add';
import { flush } from './instruction/get';
import { Model } from './model';
import { subscriber } from './subscriber';
import { suspend } from './suspense';

import type { Callback } from './helper/types';

const REGISTER = new WeakMap<{}, Control>();
const PENDING = new Map<symbol, Instruction.Runner>();

declare namespace Control {
  /**
   * Called immediately when any key is changed or emitted.
   * Returned callback is notified when update is complete.
   */
  type OnSync<T = any> = (key: Model.Event<T> | null, source: Control) => OnAsync<T> | void;

  /** Called at the end of an event frame with all keys affected. */
  type OnAsync<T = any> = (keys: Model.Event<T>[]) => void;

  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
}

class Control<T extends {} = any> {
  public state!: Map<any, any>;
  public frame = new Set<string>();
  public waiting = new Set<Control.OnAsync<T>>();
  public followers = new Set<Control.OnSync>();
  public latest?: Model.Event<T>[];

  constructor(public subject: T){
    REGISTER.set(subject, this);
  }

  watch(key: keyof T & string){
    const { subject, state } = this;
    const { value } = getOwnPropertyDescriptor(subject, key)!;

    if(typeof value == "function")
      return;

    if(typeof value == "symbol"){
      const instruction = PENDING.get(value);

      if(instruction){
        delete subject[key];
        PENDING.delete(value);
        instruction(this, key);
      }

      return;
    }

    state.set(key, value);

    if(value instanceof Model){
      setRecursive(this, key, value);
      return;
    }

    defineProperty(subject, key, {
      enumerable: false,
      set: this.ref(key as any),
      get(){
        const local = subscriber(this);

        return local
          ? local.get(key)
          : state.get(key);
      }
    });
  }

  /** Throw suspense which resolves when key is set. */
  waitFor(key: string): never {
    throw suspend(this, key);
  }

  addListener(listener: Control.OnSync<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  ref<K extends Model.Key<T>>(
    key: K,
    handler?: (this: T, value: T[K]) => boolean | void){
  
    const { subject, state } = this;
  
    return (value: any) => {
      if(state.get(key) == value)
        return;
  
      if(handler)
        switch(handler.call(subject, value)){
          case true:
            this.update(key);
          case false:
            return;
        }
  
      state.set(key, value);
      this.update(key);
    }
  }

  update(key: Model.Key<T>){
    const { followers, frame, waiting } = this;
  
    if(frame.has(key))
      return;
  
    else if(!frame.size)
      setTimeout(() => {
        flush(this);  
        const keys = this.latest = Array.from(frame);
        setTimeout(() => this.latest = undefined, 0);

        frame.clear();
      
        for(const notify of waiting)
          try {
            waiting.delete(notify);
            notify(keys);
          }
          catch(err){
            console.error(err);
          }
      }, 0);
  
    frame.add(key);
  
    for(const callback of followers){
      const event = callback(key, this);
  
      if(typeof event == "function")
        waiting.add(event);
    }
  }

  clear(){
    const listeners = [ ...this.followers ];

    this.followers.clear();
    listeners.forEach(x => x(null, this));
  }

  static get = controller;
  static for = control;
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

    control.state = new Map();

    for(const key in subject)
      control.watch(key);

    control.waiting = new Set();

    for(const cb of waiting)
      cb([]);
  }

  return cb ? cb(control) : control;
}

export {
  Control,
  control,
  controller,
  PENDING
}