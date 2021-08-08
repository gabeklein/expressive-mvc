import * as Computed from './compute';
import { runInstruction } from './instructions';
import { lifecycleEvents } from './lifecycle';
import { Stateful } from './model';
import { createEffect, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export namespace Controller {
  export type Handle =
    (on: Controller, key: string, value: any) => boolean | void;
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

  public keys(
    using?: string | Iterable<string> | Query){

    if(typeof using == "string")
      return [ using ];

    const keys = getOwnPropertyNames(this.state);

    if(!using)
      return keys;

    if(typeof using == "function")
      return selectRecursive(using, [
        ...keys, ...lifecycleEvents
      ]);

    return Array.from(using);
  }

  public add(key: string){
    const desc = getOwnPropertyDescriptor(this.subject, key);

    if(desc && "value" in desc){
      const { value } = desc;

      if(runInstruction(this, key, value))
        return;

      if(desc.enumerable && typeof value !== "function" || /^[A-Z]/.test(key))
        this.manage(key, value);
    }
  }

  public manage(
    key: string,
    initial: any,
    effect?: EffectCallback<any, any>){

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
    effect?: EffectCallback<any, any>){

    const { state, subject } = this;
    const callback = effect && createEffect(effect);

    return (value: any) => {
      if(state[key] == value)
        return;

      state[key] = value;

      if(callback)
        callback(value, subject);

      this.update(key);
    }
  }

  public watch(
    target: string | Iterable<string> | Query,
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const keys = this.keys(target);
    const batch: BunchOf<RequestCallback> = {};
    const remove = this.addListener(batch);

    const callback = squash
      ? handler.bind(this.subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(this.subject, this.state[key], key);
      }

    const handle = once
      ? (k?: string[]) => { remove(); callback(k) }
      : callback;

    for(const key of keys)
      batch[key] = handle;

    Computed.ensure(this, keys);

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

  public update(key: string){
    if(!this.pending)
      setTimeout(() => this.emit(), 0);

    if(this.frame.has(key))
      return;

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