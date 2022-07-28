import { getUpdate, Controller, UPDATE, LISTEN } from './controller';
import { LOCAL, Stateful } from './model';
import { create, defineProperty } from './util';

import type { Callback } from './types';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber <T extends Stateful = any> {
  public proxy!: T;
  public commit: () => Callback;
  public release!: Callback;

  public active = false;
  public dependant = new Set<Listener>();
  public add: (key: any, value?: boolean | Callback) => void;

  constructor(
    parent: Controller<T>,
    public onUpdate: Controller.OnEvent){

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
    
    defineProperty(proxy, LOCAL, { value: this });
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        if(UPDATE.has(proxy))
          setTimeout(() => UPDATE.delete(proxy), 0);

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

      const notate = () => {
        UPDATE.set(proxy, 
          getUpdate(parent.subject).filter(k => using.has(k))
        );
      }

      parent.waiting.add(notate);
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