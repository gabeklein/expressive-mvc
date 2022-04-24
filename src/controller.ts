import * as Computed from './compute';
import { applyUpdate } from './dispatch';
import { Pending } from './instruction/apply';
import { issues } from './issues';
import { CONTROL, Stateful } from './model';
import { defineProperty, getOwnPropertyDescriptor } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  type RequestCallback = (keys: readonly string[]) => void;
  type OnEvent = (key: string, source: Controller) => RequestCallback | void;
  type OnValue = <T>(this: T, value: any, state: T) => boolean | void;
}

const READY = new WeakSet<Controller>();

class Controller<T extends Stateful = any> {
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();
  public waiting = new Set<RequestCallback>();
  public onDestroy = new Set<Callback>();

  protected followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){}

  start(){
    for(const key in this.subject)
      this.manage(key);

    this.emit([]);
  }

  stop(){
    for(const key in this.state)
      delete (this.subject as any)[key];

    this.followers.clear();
    this.onDestroy.forEach(x => x());
  }

  manage(key: string, handler?: Controller.OnValue){
    const { state, subject } = this;
    const desc = getOwnPropertyDescriptor(subject, key);

    if(desc && "value" in desc){
      const { value } = desc;
      const instruction = Pending.get(value);

      if(instruction){
        Pending.delete(value);
        delete (subject as any)[key];
        instruction.call(this, key, this);
      }
      else if(typeof value !== "function" || /^[A-Z]/.test(key)){
        state[key] = value;
        defineProperty(subject, key, {
          enumerable: true,
          get: () => state[key],
          set: this.ref(key, handler)
        });
      }
    }
  }

  ref(key: string, handler?: Controller.OnValue){
    const { state, subject } = this;

    return (value: any) => {
      if(state[key] == value)
        return;

      if(handler)
        switch(handler.call(subject, value, state)){
          case true:
            this.update(key);
          case false:
            return;
        }

      this.update(key, value);
    }
  }

  addListener(listener: Controller.OnEvent){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  emit(keys: readonly string[]){
    const waiting = [ ...this.waiting ];

    this.waiting.clear();
    applyUpdate(this.subject, keys)();

    for(const callback of waiting)
      try {
        callback(keys)
      }
      catch(err){
        console.error(err);
      }
  }

  update(key: string, value?: any){
    if(1 in arguments)
      this.state[key] = value;

    if(this.frame.has(key))
      return;

    if(!this.frame.size)
      setTimeout(() => {
        Computed.flush(this);

        const keys = Object.freeze([ ...this.frame ]);

        this.frame.clear();
        this.emit(keys);
      }, 0);

    this.frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  requestUpdate(): PromiseLike<readonly string[] | false>;
  requestUpdate(strict: true): Promise<readonly string[]>;
  requestUpdate(strict: false): Promise<false>;
  requestUpdate(strict: boolean): Promise<readonly string[] | false>;
  requestUpdate(callback: Controller.RequestCallback): void;
  requestUpdate(arg?: boolean | RequestCallback): any {
    if(typeof arg == "function"){
      this.waiting.add(arg);
      return;
    }

    if(typeof arg == "boolean" && arg !== this.frame.size > 0)
      return Promise.reject(Oops.StrictUpdate(arg));

    return <PromiseLike<readonly string[] | false>> {
      then: (callback) => {
        if(callback)
          if(this.frame.size)
            this.waiting.add(callback);
          else
            callback(false);
        else
          throw Oops.NoChaining();
      }
    }
  }
}

type EnsureCallback<T extends Stateful> = (control: Controller<T>) => Callback | void;

export function control<T extends Stateful>(subject: T): Controller<T>;
export function control<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;
export function control<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  const control = subject[CONTROL];
  const ready = READY.has(control);

  if(!cb){
    if(!ready){
      READY.add(control);
      control.start();
    }

    return control;
  }

  if(!ready){
    let done: Callback | void;

    control.requestUpdate(() => {
      done = cb(control);
    });

    return () => done && done();
  }

  return cb(control);
}

export { Controller }