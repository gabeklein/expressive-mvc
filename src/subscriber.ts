import { addUpdate, Control, hasUpdate, LISTEN } from './control';
import { create, defineProperty } from './util';

import type { Callback } from './types';

const REGISTER = new WeakMap<{}, Subscriber>();

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber <T extends {} = any> {
  public proxy!: T;
  public commit: () => Callback;
  public release!: Callback;

  public active = false;
  public dependant = new Set<Listener>();
  public add: (key: any, value?: boolean | Callback) => void;

  static get<T extends {}>(from: T){
    return REGISTER.get(from) as Subscriber<T> | undefined;
  }

  constructor(
    parent: Control<T>,
    public onUpdate: Control.OnEvent){

    const proxy = create(parent.subject);
    const using = new Map<any, boolean | (() => true | void)>();

    const listen = this.add = (
      key: any,
      value?: boolean | Callback) => {
  
      if(value !== undefined)
        using.set(key, value);
      else if(!using.has(key))
        using.set(key, true);
    }

    LISTEN.set(proxy, listen);
    REGISTER.set(proxy, this);
    
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        hasUpdate(proxy);
        return proxy;
      }
    })

    const release = parent.addListener(key => {
      if(!this.active)
        return;

      const handler = using.get(key);
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

      parent.waiting.add(() => addUpdate(proxy, using));
      parent.waiting.add(notify);
    });

    this.commit = () => {
      this.active = true;
      this.dependant.forEach(x => x.commit());

      return this.release;
    }

    this.release = () => {
      this.dependant.forEach(x => x.release());
      release();
    }
  }
}