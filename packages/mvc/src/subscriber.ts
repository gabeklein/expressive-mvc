import { Control } from './control';
import { create, defineProperty } from './helper/object';
import { Model } from './model';

import type { Callback } from './helper/types';

const REGISTER = new WeakMap<{}, Subscriber>();

type Listener = {
  commit(): void;
  release(): void;
}

declare namespace Subscriber {
  type OnEvent<T = any> = (key: Model.Event<T> | null, source: Control) => Callback | void;
  type Getter<T extends Model> = (within?: Subscriber<T> | undefined) => any;
}

class Subscriber <T extends Model = any> {
  public proxy!: T;
  public clear: () => void;
  public latest?: Model.Event<T>[];

  public active = false;
  public dependant = new Set<Listener>();
  public watch = new Map<any, boolean | (() => boolean | void)>();
  public parent: Control<T>;

  constructor(
    parent: Control<T> | T,
    public onUpdate: Subscriber.OnEvent){

    if(!(parent instanceof Control))
      parent = Control.for(parent);

    const reset = () => this.latest = undefined;
    const proxy = create(parent.subject);

    REGISTER.set(proxy, this);

    this.parent = parent;
    this.clear = parent.addListener(key => {
      if(this.active)
        this.notify(key);
    });

    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        setTimeout(reset, 0);
        return proxy;
      }
    })

    defineProperty(proxy, "is", {
      value: parent.subject
    })
  }

  get using(): Model.Key<T>[] {
    return Array.from(this.watch.keys());
  }

  follow(key: any, value?: boolean | (() => boolean | void)){
    if(value !== undefined)
      this.watch.set(key, value);
    else if(!this.watch.has(key))
      this.watch.set(key, true);
  }

  commit(){
    this.active = true;
    this.dependant.forEach(x => x.commit());
  }

  release(){
    this.clear();
    this.dependant.forEach(x => x.release());
  }

  private notify(key: Model.Event<T> | null){
    const { parent, watch } = this;
    const handler = watch.get(key);

    if(!handler)
      return;

    if(typeof handler == "function")
      handler();

    const notify = this.onUpdate(key, parent);

    if(notify){
      parent.waiting.add(update => {
        this.latest = update.filter(k => watch.has(k));
      });
      parent.waiting.add(notify);
    }
  }
}

function subscriber<T extends Model>(from: T){
  return REGISTER.get(from) as Subscriber<T> | undefined;
}

export { Subscriber, subscriber }