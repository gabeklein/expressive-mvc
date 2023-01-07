import { Control } from './control';
import { Model } from './model';
import { create, defineProperty, getOwnPropertyNames } from './object';

import type { Callback } from './types';

const REGISTER = new WeakMap<{}, Subscriber>();

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber <T extends {} = any> {
  static get<T extends {}>(from: T){
    return REGISTER.get(from) as Subscriber<T> | undefined;
  }

  public proxy!: T;
  public release!: Callback;
  public latest?: Model.Event<T>[];

  public active = false;
  public dependant = new Set<Listener>();
  public watch = new Map<any, boolean | (() => true | void)>();

  constructor(
    public parent: Control<T>,
    public onUpdate: Control.OnEvent){

    const proxy = create(parent.subject);
    const reset = () => this.latest = undefined;

    REGISTER.set(proxy, this);
    
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        setTimeout(reset, 0);
        return proxy;
      }
    })
  }

  get using(): Model.Values<T>[] {
    return Array.from(this.watch.keys());
  }

  assign(apply: Model.Compat<T>, keys?: any){
    const { waiting, subject } = this.parent;

    this.active = false;

    if(typeof keys !== "object")
      keys = getOwnPropertyNames(subject) as Model.Field<T>[];

    for(const key of keys)
      if(key in apply)
        (subject as any)[key] = (apply as any)[key];

    waiting.add(() => this.active = true);
  }

  add(key: any, value?: boolean | Callback){
    if(value !== undefined)
      this.watch.set(key, value);
    else if(!this.watch.has(key))
      this.watch.set(key, true);
  }

  commit = () => {
    const release = this.parent.addListener(this.event);

    this.active = true;
    this.dependant.forEach(x => x.commit());

    return this.release = () => {
      this.dependant.forEach(x => x.release());
      release();
    };
  }

  private event = (key: Model.Event<T> | null) => {
    if(!this.active)
      return;

    const { parent, watch } = this;

    const handler = watch.get(key);
    let notify: void | Callback;

    if(typeof handler == "function"){
      const callback = handler();

      if(callback === true)
        notify = this.onUpdate(key, parent);
    }
    else if(handler === true)
      notify = this.onUpdate(key, parent);

    if(!notify)
      return;

    parent.waiting.add(() => {
      this.latest = parent.latest!.filter(k => watch.has(k));
    });
    parent.waiting.add(notify);
  }
}