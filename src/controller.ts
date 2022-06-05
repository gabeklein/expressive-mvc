import { applyUpdate } from './dispatch';
import { Instruction } from './instruction/apply';
import { flush } from './instruction/from';
import { issues } from './issues';
import { CONTROL, LOCAL, Model, Stateful } from './model';
import { define, defineProperty, getOwnPropertyDescriptor } from './util';

import type { Callback, RequestCallback } from './types';

export const Oops = issues({
  StrictUpdate: () => 
    `Strict update() did not find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  type OnEvent<T = any> = (key: Model.Event<T>, source: Controller) => RequestCallback | void;

  // TODO: implement value type
  type OnValue<T = any, S = Model.Values<T>> = (this: T, value: any, state: S) => boolean | void;
}

const PENDING = new Map<symbol, Instruction.Runner<any>>();
const READY = new WeakSet<Controller>();

class Controller<T extends Stateful = any> {
  public proxy: Model.Entries<T>;
  public state = {} as Model.Values<T>;
  public frame?: Set<string>;
  public onDestroy = new Set<Callback>();

  private waiting = new Set<RequestCallback>();
  protected followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){
    this.proxy = Object.create(subject);
  }

  start(){
    READY.add(this);

    for(const key in this.subject){
      const { value: entry } = getOwnPropertyDescriptor(this.subject, key)!;

      if(typeof entry == "function")
        continue;

      if(typeof entry == "symbol"){
        const instruction = PENDING.get(entry);

        if(instruction)
          instruction.call(this, key, this);

        continue;
      }

      this.manage(key as any, entry);
    }

    this.flush([]);
  }

  stop(){
    this.followers.clear();
    this.onDestroy.forEach(x => x());
  }

  manage(key: Model.Field<T>, value: any){
    const { proxy, state, subject } = this;

    state[key] = value;

    const set = this.ref(key);

    defineProperty(subject, key, {
      enumerable: false,
      get: () => state[key],
      set
    });

    defineProperty(proxy, key, {
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
    if(1 in arguments)
      this.state[key as Model.Field<T>] = value;

    if(!this.frame){
      this.frame = new Set();

      setTimeout(() => {
        flush(this.frame!);

        const keys = Object.freeze([ ...this.frame! ]);

        this.frame = undefined;
        this.flush(keys);
      }, 0);
    }
    else if(this.frame.has(key))
      return;

    this.frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  flush(keys: readonly Model.Event<T>[]){
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

  requestUpdate(): PromiseLike<readonly Model.Event<T>[] | false>;
  requestUpdate(strict: true): Promise<readonly Model.Event<T>[]>;
  requestUpdate(strict: false): Promise<false>;
  requestUpdate(strict: boolean): Promise<readonly Model.Event<T>[] | false>;
  requestUpdate(callback: (keys: readonly Model.Event<T>[]) => void): void;
  requestUpdate(arg?: boolean | RequestCallback): any {
    if(typeof arg == "function"){
      this.waiting.add(arg);
      return;
    }

    if(arg === true && !this.frame)
      return Promise.reject(Oops.StrictUpdate());

    return <PromiseLike<readonly Model.Event<T>[] | false>> {
      then: (callback) => {
        if(callback)
          if(this.frame || arg !== false)
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

function control<T extends Stateful>(subject: T): Controller<T>;
function control<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;

/** Initialize controller even if not a stateful object. */
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