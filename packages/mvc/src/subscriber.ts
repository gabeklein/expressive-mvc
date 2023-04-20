import { Control, control } from './control';
import { create, defineProperty } from './helper/object';
import { Model } from './model';

import type { Callback } from '../types';

const REGISTER = new WeakMap<{}, Subscriber>();

function subscriber<T extends Model>(from: T){
  return REGISTER.get(from) as Subscriber<T> | undefined;
}

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
  public latest?: Model.Event<T>[];

  public active = false;
  public dependant = new Set<Listener>();
  public watch = new Map<any, boolean | (() => boolean | void)>();

  get using(): Model.Key<T>[] {
    return Array.from(this.watch.keys());
  }

  constructor(
    subject: T,
    public onUpdate: Subscriber.OnEvent){

    const proxy = create(subject);
    const parent = control(subject);
    const reset = () => this.latest = undefined;

    REGISTER.set(proxy, this);

    const removeListener = parent.addListener(key => {
      const { watch, active } = this;
      const handler = watch.get(key);

      if(!handler || !active)
        return;

      if(typeof handler == "function")
        handler();

      const notify = onUpdate(key, parent);

      if(notify){
        parent.waiting.add(update => {
          this.latest = update.filter(k => watch.has(k));
        });
        parent.waiting.add(notify);
      }
    });

    this.release = () => {
      removeListener();
      this.dependant.forEach(x => x.release());
    }

    defineProperty(proxy, "is", { value: subject });
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        setTimeout(reset, 0);
        return proxy;
      }
    })
  }

  follow(key: any, value?: boolean | (() => boolean | void)){
    if(value !== undefined)
      this.watch.set(key, value);
    else if(!this.watch.has(key))
      this.watch.set(key, true);
  }

  release: () => void;

  commit(){
    this.active = true;
    this.dependant.forEach(x => x.commit());
  }
}

export { Subscriber, subscriber }