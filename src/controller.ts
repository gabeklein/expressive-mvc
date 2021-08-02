import { computeContext, ensureValue, implementGetters } from './compute';
import { runInstruction } from './instructions';
import { issues } from './issues';
import { lifecycleEvents } from './lifecycle';
import { Stateful } from './model';
import { createEffect, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, selectRecursive } from './util';

export namespace Controller {
  export type Handle =
    (on: Controller, key: string, value: any) => boolean | void;
}

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

const Pending = new WeakMap<Controller, (key: string) => void>();

export class Controller {
  public state = {} as BunchOf<any>;
  public handles = new Set<BunchOf<RequestCallback>>();
  public waiting = [] as RequestCallback[];

  constructor(public subject: Stateful){
    implementGetters(this);
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

    const { state, subject } = this;
    const keys = this.keys(target);
    const batch: BunchOf<RequestCallback> = {};
    const remove = this.addListener(batch);

    const callback = squash
      ? handler.bind(subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(subject, state[key], key);
      }

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
    let pending = Pending.get(this);

    if(!pending){
      const done = () => Pending.delete(this);
      pending = this.sync(done);
      Pending.set(this, pending);
    }

    pending(key);
  }

  public requestUpdate(arg?: RequestCallback | boolean){
    const { waiting } = this;
    const pending = Pending.get(this);

    if(typeof arg == "function")
      waiting.push(arg)
    else if(!pending === arg)
      return Promise.reject(Oops.StrictUpdate(arg))
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }

  public emit(frame?: Iterable<string>){
    const effects = this.waiting.splice(0);
    const unique = new Set(effects);
    const keys = Array.from(frame || []);

    for(const callback of unique)
      try { callback(keys) }
      catch(e){}
  }

  public sync(reset: Callback){
    const handled = new Set<string>();
    const { intercept, flush } = computeContext();

    setTimeout(() => {
      flush(handled);
      reset();
      this.emit(handled);
    }, 0);

    return (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const subscription of this.handles)
        if(key in subscription){
          const request = subscription[key];

          if(intercept(request, this))
            continue;

          this.waiting.push(request);
        }
    };
  }
}