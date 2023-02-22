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
}

class Subscriber <T extends {} = any> {
  public proxy!: T;
  public release!: Callback;
  public latest?: Model.Event<T>[];

  public active = false;
  public dependant = new Set<Listener>();
  public watch = new Map<any, boolean | (() => true | void)>();

  constructor(
    public parent: Control<T>,
    public onUpdate: Subscriber.OnEvent,
    public suspend?: boolean){

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

  get using(): Model.Key<T>[] {
    return Array.from(this.watch.keys());
  }

  add(key: any, value?: boolean | Callback){
    if(value !== undefined)
      this.watch.set(key, value);
    else if(!this.watch.has(key))
      this.watch.set(key, true);
  }

  commit(){
    const release = this.parent.addListener(key => {
      if(this.active)
        this.onEvent(key);
    });

    this.active = true;
    this.dependant.forEach(x => x.commit());

    return this.release = () => {
      this.dependant.forEach(x => x.release());
      release();
    };
  }

  private onEvent(key: Model.Event<T> | null){
    const { parent, watch } = this;
    let handler = watch.get(key);

    if(typeof handler == "function")
      handler = handler() as true | undefined;

    if(handler){
      const notify = this.onUpdate(key, parent);

      if(notify){
        parent.waiting.add(update => {
          this.latest = update.filter(k => watch.has(k));
        });
        parent.waiting.add(notify);
      }
    }
  }
}

function subscriber<T extends {}>(from: T){
  return REGISTER.get(from) as Subscriber<T> | undefined;
}

export { Subscriber, subscriber }