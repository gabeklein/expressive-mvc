import { computeContext, ensureValue, implementGetters, metaData } from './compute';
import { runInstruction } from './instructions';
import { lifecycleEvents } from './lifecycle';
import { CONTROL, Stateful } from './model';
import { Subscriber } from './subscriber';
import { createEffect, defineProperty, fn, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export namespace Controller {
  export type Handle =
    (on: Controller, key: string, value: any) => boolean | void;
}

export class Controller {
  static ensure(from: Stateful){
    return from[CONTROL];
  }

  public state = {} as BunchOf<any>;
  public handles = new Set<BunchOf<RequestCallback>>();
  public waiting = [] as RequestCallback[];

  public pending?: (key: string) => void;

  constructor(public subject: Stateful){
    implementGetters(this);
  }

  public do(fun: () => Callback){
    return fun();
  }

  public subscribe(cb: Callback, meta?: any){
    const sub = new Subscriber(this, cb);

    if(meta)
      metaData(cb, meta);

    return sub;
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

    if(fn(using))
      return selectRecursive(using, [
        ...keys, ...lifecycleEvents
      ]);

    return Array.from(using);
  }

  public add(
    key: string,
    handle = runInstruction){

    const desc = getOwnPropertyDescriptor(this.subject, key);

    if(desc && "value" in desc){
      const { value, enumerable } = desc;

      if(handle(this, key, value))
        return;

      if(enumerable && !fn(value) || /^[A-Z]/.test(key))
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
    target: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const { state, subject } = this;
    const keys = ([] as string[]).concat(target);
    const batch: BunchOf<RequestCallback> = {};

    const callback = squash
      ? handler.bind(subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(subject, state[key], key);
      }

    const remove = this.addListener(batch);
    const handle = once
      ? (k?: string[]) => { remove(); callback(k) }
      : callback;

    for(const key of keys){
      ensureValue(subject, key);
      batch[key] = handle;
    }

    return remove;
  }

  public addListener(
    batch: BunchOf<RequestCallback>){

    this.handles.add(batch);
    return () => {
      this.handles.delete(batch)
    }
  }

  public update(key: string){
    (this.pending || this.sync())(key);
  }

  public emit(frame?: string[]){
    const effects = this.waiting.splice(0);
    const unique = new Set(effects);

    for(const callback of unique)
      try { callback(frame) }
      catch(e){}
  }

  public sync(){
    const handled = new Set<string>();
    const computed = computeContext(this, handled);

    const include = (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const subscription of this.handles)
        if(key in subscription){
          const request = subscription[key];

          if(computed.queue(request))
            continue;

          this.waiting.push(request);
        }
    }

    const close = () => {
      computed.flush();
      this.pending = undefined;
      this.emit(Array.from(handled));
    }

    setTimeout(close, 0);
    return this.pending = include;
  }
}