import { getUpdate, Controller, UPDATE } from './controller';
import { LOCAL, Stateful } from './model';
import { create, define, defineProperty } from './util';

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

    define(proxy, LOCAL, this);

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
  
      const getWhy: Callback = () => {
        const update = getUpdate(parent.subject);
        const applicable = update.filter(k => using.has(k));

        UPDATE.set(proxy, applicable);
      }

      if(notify){
        parent.waiting.add(getWhy);
        parent.waiting.add(notify);
      }
    });

    this.commit = () => {
      this.active = true;
      this.dependant.forEach(x => x.commit?.());

      return this.release;
    }

    this.release = () => {
      this.dependant.forEach(x => x.release?.());
      release();
    }

    this.add = (key, value) => {
      if(value !== undefined)
        using.set(key, value);
      else if(!using.has(key))
        using.set(key, true);
    }
  }
}