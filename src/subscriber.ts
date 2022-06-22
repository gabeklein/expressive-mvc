import { Controller } from './controller';
import { applyUpdate, getUpdate } from './dispatch';
import { LOCAL, Model, Stateful } from './model';
import { ensure } from './stateful';
import { create, define, defineProperty } from './util';

import type { Callback } from './types';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber <T extends Stateful = any> {
  public proxy!: T;
  public release!: Callback;
  public commit: () => () => void;

  public active = false;
  public dependant = new Set<Listener>();
  public watch = {} as {
    [key in Model.Event<T>]: Callback | boolean;
  }

  constructor(
    target: Controller<T> | T,
    public onUpdate: Controller.OnEvent){

    const parent = target instanceof Controller
      ? target : ensure(target);

    const subject = parent.subject;
    const proxy = create(parent.subject);

    let reset: Callback | undefined;

    define(proxy, LOCAL, this);
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        if(reset)
          setTimeout(reset, 0);

        return proxy;
      }
    })

    const release = parent.addListener(key => {
      const handler = this.watch[key as string];

      if(!handler || !this.active)
        return;

      if(typeof handler == "function")
        handler();

      const notify = this.onUpdate(key, parent);
      const getWhy: Callback = () => {
        const update = getUpdate(subject);
        const applicable = update.filter(k => k in this.watch);
        reset = applyUpdate(proxy, applicable);
      }

      if(notify){
        parent.request(getWhy);
        parent.request(notify);
      }
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