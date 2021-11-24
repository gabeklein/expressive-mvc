import * as Computed from './compute';
import { lifecycleEvents } from './lifecycle';
import { Subscriber } from './subscriber';
import { defineLazy, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export const CONTROL = Symbol("control");
export const CREATE = Symbol("start");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export const Pending = new Map<symbol, Instruction<any>>();

export function manage(src: Stateful){
  return src[CONTROL];
}

export function set<T = any>(
  instruction: Instruction<any>, label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  Pending.set(placeholder,
    function set(key){
      let output = instruction.call(this, key, this);
  
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
  );

  return placeholder as unknown as T;
}

export interface Stateful {
  [CONTROL]: Controller;
  [CREATE]?(has: Controller): Callback | void;
  [LOCAL]?: Subscriber;
  [STATE]?: any;

  didCreate?(): void;
};

export type HandleValue = (this: Stateful, value: any) => boolean | void;

export type Getter<T> = (sub?: Subscriber) => T
export type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
  void | Getter<T> | PropertyDescriptor;

export class Controller {
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();

  protected handles = new Set<BunchOf<RequestCallback>>();
  protected waiting = [] as RequestCallback[];

  constructor(public subject: Stateful){}

  static setup(onto: Stateful){
    const create = onto[CREATE];
    const control = new this(onto);
    const after = create && create.call(onto, control);

    defineLazy(onto, CONTROL, () => {
      onto[STATE] = control.state;
      control.start();

      if(after)
        after();

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

    this.handles.add(batch);
    return () => {
      this.handles.delete(batch)
    }
  }

  public include(to: RequestCallback){
    if(Computed.capture(this, to))
      return;
    else
      this.waiting.push(to)
  }

  public update(key: string, value?: any){
    if(1 in arguments)
      this.state[key] = value;

    if(this.frame.has(key))
      return;

    if(!this.frame.size)
      setTimeout(() => this.emit(), 0);

    this.frame.add(key);

    for(const subscription of this.handles)
      if(key in subscription)
        this.include(subscription[key]);
  }

  public emit(){
    Computed.flush(this);

    const keys = Array.from(this.frame);
    const handle = new Set(this.waiting.splice(0));

    this.frame.clear();

    handle.forEach(callback => {
      try { callback(keys) }
      catch(e){ }
    })
  }
}

export function keys(
  from: Controller,
  using?: string | Iterable<string> | Query){

  if(typeof using == "string")
    return [ using ];

  if(typeof using == "object")
    return Array.from(using);

  return from.select(using);
}