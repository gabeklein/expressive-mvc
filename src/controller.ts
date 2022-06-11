import { applyUpdate, getUpdate } from './dispatch';
import { Instruction } from './instruction/apply';
import { flush } from './instruction/from';
import { issues } from './issues';
import { CONTROL, LOCAL, Model, Stateful } from './model';
import { define, defineProperty, getOwnPropertyDescriptor } from './util';

import type { Callback } from './types';

export const Oops = issues({
  StrictUpdate: () => 
    `Strict update() did not find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  // TODO: implement value type
  type OnValue<T = any, S = Model.Values<T>> = (this: T, value: any, state: S) => boolean | void;
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Controller) => Callback | void;
}

const PENDING = new Map<symbol, Instruction.Runner<any>>();
const READY = new WeakSet<Controller>();

class Controller<T extends Stateful = any> {
  public proxy: Model.Entries<T>;
  public state = {} as Model.Values<T>;
  public frame = new Set<string>();

  private waiting = new Set<Callback>();
  protected followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){
    this.proxy = Object.create(subject);
  }

  start(){
    READY.add(this);

    for(const key in this.subject){
      const { value } = getOwnPropertyDescriptor(this.subject, key)!;

      if(typeof value == "function")
        continue;

      if(typeof value == "symbol"){
        const instruction = PENDING.get(value);

        if(instruction)
          instruction.call(this, key, this);

        continue;
      }

      this.manage(key as any, value);
    }

    this.flush();
  }

  stop(){
    const listeners = [ ...this.followers ];

    this.followers.clear();
    listeners.forEach(x => x(null, this));
  }

  manage(key: Model.Field<T>, value: any){
    const { state } = this;
    const set = this.ref(key);

    state[key] = value;

    defineProperty(this.subject, key, {
      enumerable: false,
      get: () => state[key],
      set
    });

    defineProperty(this.proxy, key, {
      enumerable: false,
      get(){
        const local = this[LOCAL];

        if(local && !local.watch[key])
          local.watch[key] = true;

        return state[key];
      },
      set
    });
  }

  ref(key: Model.Field<T>, handler?: Controller.OnValue<T>){
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

  addListener(listener: Controller.OnEvent<T>){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  update(key: Model.Event<T>, value?: any){
    const { frame } = this;

    if(1 in arguments)
      this.state[key as Model.Field<T>] = value;

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

  requestUpdate(): PromiseLike<readonly Model.Event<T>[] | false>;
  requestUpdate(strict: true): Promise<readonly Model.Event<T>[]>;
  requestUpdate(strict: false): Promise<false>;
  requestUpdate(strict: boolean): Promise<readonly Model.Event<T>[] | false>;
  requestUpdate(callback: Callback): void;
  requestUpdate(arg?: boolean | Callback): any {
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

type EnsureCallback<T extends Stateful> = (control: Controller<T>) => Callback | void;

function control<T extends Stateful>(subject: T): Controller<T>;
function control<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;
function control<T extends {}>(subject: T): Controller<T & Stateful>;

function control<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  let control = subject[CONTROL];

  if(!control){
    control = new Controller(subject as unknown as Stateful);
    define(subject, CONTROL, control);
  }

  const ready = READY.has(control);

  if(!ready){
    if(cb){
      let done: Callback | void;

      control.requestUpdate(() => done = cb(control));

      return () => done && done();
    }

    control.start();
  }

  return cb ? cb(control) : control;
}

export { PENDING, Controller, control }