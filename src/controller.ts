import { applyUpdate } from './dispatch';
import { Pending } from './instruction/apply';
import { flush } from './instruction/from';
import { Instruction } from './instruction/types';
import { issues } from './issues';
import { CONTROL, LOCAL, Model, Stateful } from './model';
import { Callback, RequestCallback } from './types';
import { define, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
});

declare namespace Controller {
  type OnEvent<T = any> = (key: Model.Event<T>, source: Controller) => RequestCallback | void;
  
  // TODO: implement value type
  type OnValue<T = any, S = Model.Values<T>> = (this: T, value: any, state: S) => boolean | void;
}

const READY = new WeakSet<Controller>();

class Controller<T extends Stateful = any> {
  public proxy: Model.Entries<T>;
  public state = {} as Model.Values<T>;
  public frame = new Set<string>();
  public waiting = new Set<RequestCallback>();
  public onDestroy = new Set<Callback>();

  protected followers = new Set<Controller.OnEvent>();

  constructor(public subject: T){
    this.proxy = Object.create(subject);
  }

  start(){
    for(const key in this.subject)
      this.manage(key as unknown as Model.Field<T>);

    this.emit([]);
  }

  stop(){
    this.followers.clear();
    this.onDestroy.forEach(x => x());
  }

  private manage(key: Model.Field<T>){
    const { proxy, state, subject } = this;
    const { value: entry } = getOwnPropertyDescriptor(subject, key)!;

    if(typeof entry == "function")
      return;

    let onGet: Instruction.Getter<any> | undefined;
    let onSet: Instruction.Setter<any> | false | undefined;
    let enumerable: any;

    const instruction = Pending.get(entry);

    if(instruction){
      Pending.delete(entry);
      delete subject[key];
      const desc = instruction.call(this, key, this);

      if(desc === false)
        return;

      if(typeof desc == "object"){
        if("value" in desc)
          state[key] = desc.value as any;

        onSet = desc.set;
        onGet = desc.get;
        enumerable = desc.enumerable;
      }
    }
    else
      state[key] = entry;

    const set =
      onSet !== false
        ? this.ref(key, onSet)
        : undefined;

    function get(this: Stateful){
      const value = state[key];
      const local = this[LOCAL];

      if(local && !local.watch[key])
        local.watch[key] = true;

      return onGet
        ? local
          ? onGet(value, local)
          : onGet(value)
        : value;
    }

    setAlias(get, `tap ${key}`);

    for(const x of [subject, proxy])
      defineProperty(x, key, {
        enumerable, get, set
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

  emit(keys: readonly Model.Event<T>[]){
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

  update(key: Model.Event<T>, value?: any){
    if(1 in arguments)
      this.state[key as Model.Field<T>] = value;

    if(this.frame.has(key))
      return;

    if(!this.frame.size)
      setTimeout(() => {
        flush(this);

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

    if(typeof arg == "boolean" && arg !== this.frame.size > 0)
      return Promise.reject(Oops.StrictUpdate(arg));

    return <PromiseLike<readonly Model.Event<T>[] | false>> {
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

function control<T extends Stateful>(subject: T): Controller<T>;
function control<T extends Stateful>(subject: T, cb: EnsureCallback<T>): Callback;

/** Initialize controller even if not a stateful object. */
function control<T extends {}>(subject: T): Controller<T & Stateful>;

function control<T extends Stateful>(subject: T, cb?: EnsureCallback<T>){
  let control = subject[CONTROL];
  const ready = READY.has(control);

  if(!control){
    control = new Controller(subject as unknown as Stateful);
    define(subject, CONTROL, control);
  }

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

export { Controller, control }