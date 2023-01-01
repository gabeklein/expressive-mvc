import { PENDING } from './instruction/apply';
import { flush } from './instruction/get.compute';
import { Model, Stateful } from './model';
import { Subscriber } from './subscriber';
import { defineProperty, getOwnPropertyDescriptor } from './util';

import type { Callback } from './types';

type ListenToKey = <T = any>(key: T, callback?: boolean | Callback) => void;

const UPDATE = new WeakMap<{}, readonly string[]>();
const LISTEN = new WeakMap<{}, ListenToKey>();
const CONTROL = Symbol("CONTROL");

function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Field<T>[];
}

declare namespace Controller {
  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Controller) => Callback | void;
}

class Controller<T extends Stateful = any> {
  public state!: Map<any, any>;
  public frame = new Set<string>();
  public waiting = new Set<Callback>();
  public followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){}

  subscribe(callback: Controller.OnEvent<T>){
    return new Subscriber<T>(this, callback);
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
        instruction.call(this, key, this);
      }

      return;
    }

    state.set(key, value);

    defineProperty(subject, key, {
      enumerable: false,
      set: this.ref(key as any),
      get(){
        const listen = LISTEN.get(this);

        if(listen)
          listen(key);

        return state.get(key);
      }
    });
  }

  addListener(listener: Controller.OnEvent<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  ref(
    key: Model.Field<T>,
    handler?: Controller.OnValue<T>){
  
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

  update(key: Model.Field<T>){
    const { followers, frame, subject, waiting } = this;
  
    if(frame.has(key))
      return;
  
    else if(!frame.size)
      setTimeout(() => {
        flush(this);
      
        UPDATE.set(subject, Array.from(frame));

        setTimeout(() => {
          UPDATE.delete(subject);
        }, 0);
      
        frame.clear();
      
        for(const notify of waiting)
          try {
            waiting.delete(notify);
            notify();
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
}

type EnsureCallback<T extends Stateful> = (control: Controller<T>) => Callback | void;

function ensure<T extends Stateful>(subject: T): Controller<T>;
function ensure<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;
function ensure<T extends {}>(subject: T): Controller<T & Stateful>;

function ensure<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  let control = subject[CONTROL]!;

  if(!control){
    control = new Controller(subject as unknown as Stateful)
    defineProperty(subject, CONTROL, { value: control });
  }

  if(!control.state){
    const { waiting } = control;

    if(cb){
      let done: Callback | void;

      waiting.add(() => {
        done = cb(control);
      });

      return () => done && done();
    }

    control.state = new Map();

    for(const key in subject)
      control.watch(key);

    const callback = Array.from(waiting);

    waiting.clear();
    
    for(const cb of callback)
      cb();
  }

  return cb ? cb(control) : control;
}

export {
  ensure,
  Controller,
  getUpdate,
  UPDATE,
  LISTEN,
  CONTROL
}