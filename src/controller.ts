import * as Computed from './compute';
import { apply } from './instructions';
import { lifecycleEvents } from './lifecycle';
import { Subscriber } from './subscriber';
import { defineLazy, defineProperty, entriesIn, getOwnPropertyNames, selectRecursive } from './util';

export const CONTROL = Symbol("control");
export const LOCAL = Symbol("local");
export const STATE = Symbol("state");

export function manage(src: Stateful){
  return src[CONTROL];
}

export interface Stateful {
  [CONTROL]: Controller;
  [LOCAL]?: Subscriber;
  [STATE]?: any;
};

export namespace Controller {
  export type HandleValue = (this: Stateful, value: any) => boolean | void;
}

export class Controller {
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();

  protected handles = new Set<BunchOf<RequestCallback>>();
  protected waiting = [] as RequestCallback[];

  constructor(public subject: Stateful){}

  static init(onto: Stateful, after?: Callback){
    const control = new this(onto);

    defer(control, "on");
    defer(control, "effect");

    defineLazy(onto, CONTROL, () => {
      delete (onto as any).on;
      delete (onto as any).effect;

      onto[STATE] = control.state;

      control.start();
      after && after();

      return control;
    })
  }

  public get pending(){
    return this.frame.size > 0;
  }

  public start(){
    entriesIn(this.subject).forEach(([key, desc]) => {
      if(desc && desc.enumerable && "value" in desc){
        const { value } = desc;
  
        if(apply(this, key, value))
          return;
  
        if(typeof value !== "function" || /^[A-Z]/.test(key))
          this.manage(key, value);
      }
    });

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
    effect?: Controller.HandleValue){

    const { state, subject } = this;

    state[key] = initial;
    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      get: () => state[key],
      set: this.sets(key, effect)
    });
  }

  public sets(
    key: string,
    handler?: Controller.HandleValue){

    const { state, subject } = this;

    return (value: any) => {
      if(state[key] == value)
        return;

      if(handler)
        switch(handler.call(subject, value)){
          case true:
            this.update(key)
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

    handle.forEach(cb => {
      try { cb(keys) }
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

function defer(on: Controller, method: string){
  const { subject, waiting } = on as any;
  const real = subject[method];

  subject[method] = (...args: any[]) => {
    let done: any;
    waiting.push(() => {
      done = real.apply(subject, args);
    });
    return () => done();
  }
}