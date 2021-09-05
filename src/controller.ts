import * as Computed from './compute';
import { apply } from './instructions';
import { lifecycleEvents } from './lifecycle';
import { Stateful } from './model';
import { defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export namespace Controller {
  export type HandleValue = (this: Stateful, value: any) => boolean | void;
}

export class Controller {
  public state = {} as BunchOf<any>;
  public frame = new Set<string>();

  protected handles = new Set<BunchOf<RequestCallback>>();
  protected waiting = [] as RequestCallback[];

  constructor(public subject: Stateful){
    Computed.bootstrap(this);
  }

  public get pending(){
    return this.frame.size > 0;
  }

  public start(){
    getOwnPropertyNames(this.subject)
      .forEach(k => this.add(k));

    this.emit();

    return this;
  }

  public select(using?: Query){
    const keys = getOwnPropertyNames(this.state);

    return using
      ? selectRecursive(using, keys.concat(lifecycleEvents))
      : keys;
  }

  public add(key: string){
    const desc = getOwnPropertyDescriptor(this.subject, key);

    if(desc && "value" in desc){
      const { value } = desc;

      if(apply(this, key, value))
        return;

      if(desc.enumerable && typeof value !== "function" || /^[A-Z]/.test(key))
        this.manage(key, value);
    }
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

  public watch(
    subset: string | Iterable<string> | Query,
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const set = keys(this, subset);
    const batch = {} as BunchOf<RequestCallback>;
    const remove = this.addListener(batch);

    const callback = squash
      ? handler.bind(this.subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(set.includes(key))
            handler.call(this.subject, this.state[key], key);
      }

    const handle = once
      ? (k?: string[]) => { remove(); callback(k) }
      : callback;

    for(const key of set)
      batch[key] = handle;

    Computed.ensure(this, set);

    return remove;
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