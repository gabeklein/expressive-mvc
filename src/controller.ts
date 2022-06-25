import { flush } from './instruction/from';
import { Model, Stateful } from './model';
import { STATE } from './stateful';

import type { Callback } from './types';

const UPDATE = new WeakMap<{}, readonly string[]>();

function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Field<T>[];
}

declare namespace Controller {
  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Controller) => Callback | void;
}

class Controller<T extends Stateful = any> {
  public frame = new Set<string>();
  public waiting = new Set<Callback>();
  public followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){}

  get state(){
    return STATE.get(this.subject)!;
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
    const { followers, frame, waiting } = this;
  
    if(frame.has(key))
      return;
  
    else if(!frame.size)
      setTimeout(() => this.emit(), 0);
  
    frame.add(key);
  
    for(const callback of followers){
      const event = callback(key, this);
  
      if(typeof event == "function")
        waiting.add(event);
    }
  }

  emit(){
    const { frame, subject, waiting } = this;
  
    flush(this);
  
    const callback = Array.from(waiting);
    const keys = Array.from(frame);
  
    frame.clear();
    waiting.clear();
  
    UPDATE.set(subject, keys);
  
    setTimeout(() => {
      UPDATE.delete(subject);
    }, 0);
  
    for(const cb of callback)
      try {
        cb();
      }
      catch(err){
        console.error(err);
      }
  }

  clear(){
    const listeners = [ ...this.followers ];

    this.followers.clear();
    listeners.forEach(x => x(null, this));
  }
}

export { Controller, getUpdate, UPDATE }