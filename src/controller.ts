import { applyUpdate, getUpdate } from './dispatch';
import { flush } from './instruction/from';
import { issues } from './issues';
import { Model, Stateful } from './model';
import { STATE } from './stateful';

import type { Callback } from './types';

export const Oops = issues({
  StrictUpdate: () => 
    `Strict update() did not find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  // TODO: implement value type
  type OnValue<T = any> = (this: T, value: any) => boolean | void;
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Controller) => Callback | void;
}

class Controller<T extends Stateful = any> {
  public frame = new Set<string>();

  private waiting = new Set<Callback>();
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

      this.update(key, value);
    }
  }

  addListener(listener: Controller.OnEvent<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  update(key: Model.Field<T>, value?: any){
    const { frame } = this;

    if(1 in arguments)
      this.state.set(key, value);

    if(!frame.size)
      setTimeout(() => {
        flush(frame!);
        this.flush();
      }, 0);

    else if(frame.has(key))
      return;

    frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  flush(){
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

  request(): PromiseLike<readonly Model.Event<T>[] | false>;
  request(strict: true): Promise<readonly Model.Event<T>[]>;
  request(strict: false): Promise<false>;
  request(strict: boolean): Promise<readonly Model.Event<T>[] | false>;
  request(callback: Callback): void;
  request(arg?: boolean | Callback): any {
    const { frame, subject, waiting } = this;

    if(typeof arg == "function"){
      waiting.add(arg);
      return;
    }

    if(!frame.size && arg === true)
      return Promise.reject(Oops.StrictUpdate());

    return <PromiseLike<readonly Model.Event<T>[] | false>> {
      then: (callback) => {
        if(!callback)
          throw Oops.NoChaining();

        if(frame.size || arg !== false)
          waiting.add(() => {
            callback(getUpdate(subject));
          });
        else
          callback(false);
      }
    }
  }
}

export { Controller }