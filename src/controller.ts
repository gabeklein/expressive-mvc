import * as Computed from './compute';
import { lifecycleEvents } from './lifecycle';
import { Subscriber } from './subscriber';
import { defineLazy, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export const CONTROL = Symbol("control");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export interface Stateful {
  [CONTROL]: Controller;
  [LOCAL]?: Subscriber;
  [STATE]?: any;

  didCreate?(): void;
};

export function manage(src: Stateful){
  return src[CONTROL];
}

export const Pending = new Map<symbol, Instruction<any>>();

export function apply<T = any>(
  fn: Instruction<any>, label?: string){

  const name = label || fn.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Controller, key: string){
    let output = fn.call(this, key, this);

    if(typeof output == "function"){
      const getter = output;

      output = {
        ...getOwnPropertyDescriptor(this.subject, key),
        get(this: Stateful){
          return getter(this[LOCAL])
        }
      }
    }

    if(output)
      defineProperty(this.subject, key, output);
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}

export type HandleValue = (this: Stateful, value: any) => boolean | void;

export type Getter<T> = (sub?: Subscriber) => T
export type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
  void | Getter<T> | PropertyDescriptor;

export class Controller {
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();
  public waiting = new Set<RequestCallback>();

  protected handles = new Set<BunchOf<RequestCallback>>();

  constructor(public subject: Stateful){}

  static setup(onto: Stateful){
    const control = new this(onto);

    defineLazy(onto, CONTROL, () => {
      onto[STATE] = control.state;
      control.start();

      if(onto.didCreate)
        onto.didCreate();

      return control;
    })

    return control;
  }

  public get pending(){
    return this.frame.size > 0;
  }

  public start(){
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

    return this;
  }

  public select(using?: Query){
    const keys = getOwnPropertyNames(this.state);

    return using
      ? selectRecursive(using, keys.concat(lifecycleEvents))
      : keys;
  }

  public manage(
    key: string,
    initial: any,
    effect?: HandleValue){

    const { state, subject } = this;

    state[key] = initial;
    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      get: () => state[key],
      set: this.setter(key, effect)
    });
  }

  public setter(
    key: string,
    handler?: HandleValue){

    const { state, subject } = this;

    return (value: any) => {
      if(state[key] == value)
        return;

      if(handler)
        switch(handler.call(subject, value)){
          case true:
            this.update(key);
          case false:
            return;
        }

      this.update(key, value);
    }
  }

  public addListener(
    batch: BunchOf<RequestCallback>){

    Computed.ensure(this, Object.keys(batch));

    this.handles.add(batch);
    return () => {
      this.handles.delete(batch)
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

    for(const handle of this.handles)
      if(key in handle){
        const to = handle[key];

        if(Computed.defer(this, to))
          continue;
        else
          this.waiting.add(to)
      }
  }

  public emit(){
    Computed.flush(this);

    const keys = Object.freeze([ ...this.frame ]);
    const handle = new Set(this.waiting);

    this.waiting.clear();
    this.frame.clear();

    handle.forEach(callback => {
      try { callback(keys) }
      catch(e){ }
    })
  }
}

export function keys(
  from: Controller,
  using?: string | string[] | Set<string> | Query){

  if(typeof using == "string")
    return [ using ];

  if(typeof using == "object"){
    using = Array.from(using);
    
    if(using.length === 0)
      using = undefined;
    else
      return using;
  }

  return from.select(using);
}