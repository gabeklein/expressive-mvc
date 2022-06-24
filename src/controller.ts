import { emitUpdate } from './dispatch';
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

  addListener(listener: Controller.OnEvent<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  update(key: Model.Field<T>){
    const { followers, frame, waiting } = this;

    if(frame.has(key))
      return;

    else if(!frame.size)
      setTimeout(() => {
        flush(frame!);
        emitUpdate(this);
      }, 0);

    frame.add(key);

    for(const callback of followers){
      const event = callback(key, this);

      if(typeof event == "function")
        waiting.add(event);
    }
  }
}

export function createRef<T extends Stateful>(
  control: Controller<T>,
  key: Model.Field<T>,
  handler?: Controller.OnValue<T>){

  const { subject, state } = control;

  return (value: any) => {
    if(state.get(key) == value)
      return;

    if(handler)
      switch(handler.call(subject, value)){
        case true:
          control.update(key);
        case false:
          return;
      }

    state.set(key, value);
    control.update(key);
  }
}

export { Controller }