import * as Computed from './compute';
import { issues } from './issues';
import { LOCAL, Stateful, UPDATE } from './model';
import { Subscriber } from './subscriber';
import { defineProperty, getOwnPropertyDescriptor } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`,

  NoChaining: () =>
    `Then called with undefined; update promise will never catch nor supports chaining.`
})

export const Pending = new Map<symbol, Instruction<any>>();

export function apply<T = any>(
  fn: Instruction<any>, label?: string){

  const name = label || fn.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Controller, key: string){
    const { subject, state } = this;
    let output = fn.call(this, key, this);
    let desc: PropertyDescriptor | undefined;

    if(!output)
      return;

    if(typeof output == "function"){
      const getter = output;

      desc = {
        set: this.setter(key),
        ...getOwnPropertyDescriptor(subject, key),
        get(this: Stateful){
          return getter(state[key], this[LOCAL])
        }
      }
    }
    else {
      const { get, set, value } = output;

      desc = {};

      if(output.enumerable)
        desc.enumerable = true;

      if(output.configurable)
        desc.configurable = true;

      if("value" in output){
        state[key] = value;
        
        if(!get && !set){
          defineProperty(subject, key, { value });
          return;
        }
      }

      desc!.get = get
        ? function(this: Stateful){
          return get(state[key], this[LOCAL]);
        }
        : () => state[key];

      desc!.set = this.setter(key, set);
    }

    defineProperty(subject, key, desc as any);
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}

declare namespace Instruction {
    type Getter<T> = (state: T | undefined, within?: Subscriber) => T;

    interface Descriptor<T> {
        configurable?: boolean;
        enumerable?: boolean;
        value?: T;
        writable?: boolean;
        get: Getter<T>;
        set?(value: T, state: any): boolean | void;
    }
}

type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
        void | Instruction.Getter<T> | Instruction.Descriptor<T>;

declare namespace Controller {
  type Listen = (key: string, source: Controller) => RequestCallback | void;
  type OnValue = <T>(this: T, value: any, state: T) => boolean | void;
}

class Controller {
  ready = false;
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();
  public waiting = new Set<RequestCallback>();

  protected followers = new Set<Controller.Listen>();

  constructor(public subject: Stateful){}

  public get pending(){
    return this.frame.size > 0;
  }

  public start(){
    if(this.ready)
      return;

    const { subject } = this;
    
    for(const key in subject){
      const desc = getOwnPropertyDescriptor(subject, key);

      if(desc && "value" in desc){
        const { value } = desc;
        const instruction = Pending.get(value);

        if(instruction){
          Pending.delete(value);
          delete (subject as any)[key];
          instruction.call(this, key, this);
        }
        else if(typeof value !== "function" || /^[A-Z]/.test(key))
          this.manage(key, value);
      }
    }

    this.emit();
    this.ready = true;

    return this;
  }

  public manage(
    key: string,
    initial: any,
    handler?: Controller.OnValue){

    const { state, subject } = this;

    state[key] = initial;
    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      get: () => state[key],
      set: this.setter(key, handler)
    });
  }

  public setter(
    key: string,
    handler?: Controller.OnValue){

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

  public addListener(listener: Controller.Listen){
    this.followers.add(listener);
    return () => {
      this.followers.delete(listener)
    }
  }

  public update(key: string, value?: any){
    if(1 in arguments)
      this.state[key] = value;

    if(this.frame.has(key))
      return;

    if(!this.frame.size)
      setTimeout(() => this.emit(), 0);

    this.frame.add(key);

    for(const callback of this.followers){
      const event = callback(key, this);

      if(typeof event == "function")
        this.waiting.add(event);
    }
  }

  public requestUpdate(strict?: boolean): any {
    if(strict !== undefined && !this.pending === strict)
      return Promise.reject(Oops.StrictUpdate(strict));

    return <PromiseLike<readonly string[] | false>> {
      then: (callback) => {
        if(callback)
          if(this.pending)
            this.waiting.add(callback);
          else
            callback(false);
        else
          throw Oops.NoChaining();
      }
    }
  }

  private emit(){
    Computed.flush(this);

    const keys = Object.freeze([ ...this.frame ]);
    const handle = new Set(this.waiting);

    this.waiting.clear();
    this.frame.clear();

    defineProperty(this.subject, UPDATE, {
      configurable: true,
      value: keys
    })

    handle.forEach(callback => {
      try { callback(keys) }
      catch(e){ }
    })
  }
}

export { Controller, Instruction }