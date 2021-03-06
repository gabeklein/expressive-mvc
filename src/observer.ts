import { computeContext, ensureValue, implementGetters } from './compute';
import { Stateful } from './controller';
import { createEffect, defineProperty, entriesIn, fn } from './util';

export class Observer {
  public state = {} as BunchOf<any>;
  public listeners = new Set<BunchOf<RequestCallback>>();
  public waiting = [] as RequestCallback[];

  public pending?: (key: string) => void;

  constructor(public subject: Stateful){
    implementGetters(this);
  }

  public start(){
    for(const [key, desc] of entriesIn(this.subject))
      this.setup(key, desc);

    this.emit();
  }

  public setup(key: string, desc: PropertyDescriptor){
    if("value" in desc && desc.enumerable)
      if(!fn(desc.value) || /^[A-Z]/.test(key))
        this.register(key, desc.value);
  }

  public register(
    key: string,
    initial: any,
    effect?: EffectCallback<any, any>){

    this.state[key] = initial;
    this.override(key, {
      get: () => this.state[key],
      set: this.setter(key, effect)
    });
  }

  public override(
    key: string,
    desc: PropertyDescriptor){

    defineProperty(this.subject, key, {
      enumerable: true, ...desc
    });
  }

  public setter(
    key: string,
    effect?: EffectCallback<any, any>){

    const callback =
      effect && createEffect(effect);

    return (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(callback)
        callback(value, this.subject);

      this.update(key);
    }
  }

  public watch(
    target: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const keys = ([] as string[]).concat(target);

    const callback = squash
      ? handler.bind(this.subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(this.subject, this.state[key], key);
      }

    return this.addListener(keys, callback, once);
  }

  public addListener(
    keys: Iterable<string>,
    callback: RequestCallback,
    once?: boolean){

    const remove = () => { this.listeners.delete(listener) };
    const handler = once ? (k?: string[]) => { remove(); callback(k) } : callback;
    const listener: BunchOf<RequestCallback> = {};

    for(const key of keys){
      ensureValue(this.subject, key);
      listener[key] = handler;
    }

    this.listeners.add(listener);

    return remove;
  }

  public update(key: string){
    (this.pending || this.sync())(key);
  }

  public emit(frame?: string[]){
    const current = this.waiting;

    this.waiting = [];
    this.pending = undefined;

    for(const handle of current)
      try { handle(frame) }
      catch(e){}
  }

  public sync(){
    const handled = new Set<string>();

    const {
      queue: queueComputed,
      flush: flushComputed
    } = computeContext(this, handled);

    const include = (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const subscription of this.listeners)
        if(key in subscription){
          const request = subscription[key];

          if(queueComputed(request))
            continue;

          this.waiting.push(request);
        }
    }

    const close = () => {
      flushComputed();
      this.emit(Array.from(handled));
    }

    setTimeout(close, 0);
    return this.pending = include;
  }
}