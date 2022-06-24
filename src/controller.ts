import { applyUpdate } from './dispatch';
import { flush } from './instruction/from';
import { Model, Stateful } from './model';
import { STATE } from './stateful';

import type { Callback } from './types';

declare namespace Controller {
  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Controller) => Callback | void;
}

class Controller<T extends Stateful = any> {
  public frame = new Set<string>();
  public waiting = new Set<Callback>();
  protected followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){}

  get state(){
    return STATE.get(this.subject)!;
  }

  stop(){
    const listeners = [ ...this.followers ];

    this.followers.clear();
    listeners.forEach(x => x(null, this));
  }

  ref(key: Model.Field<T>, handler?: Controller.OnValue<T>){
    return (value: any) => {
      if(this.state.get(key) == value)
        return;

      if(handler)
        switch(handler.call(this.subject, value)){
          case true:
            this.update(key);
          case false:
            return;
        }

      this.state.set(key, value);
      this.update(key);
    }
  }

  addListener(listener: Controller.OnEvent<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  update(key: Model.Field<T>){
    const { frame } = this;

    if(frame.has(key))
      return;

    else if(!frame.size)
      setTimeout(() => {
        flush(frame!);
        this.emit();
      }, 0);

    frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  emit(){
    const waiting = Array.from(this.waiting);
    const keys = Array.from(this.frame);

    this.frame.clear();
    this.waiting.clear();

    applyUpdate(this.subject, keys)();

    for(const callback of waiting)
      try {
        callback();
      }
      catch(err){
        console.error(err);
      }
  }
}

export { Controller }