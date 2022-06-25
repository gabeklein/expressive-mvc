import { getUpdate, Controller, UPDATE } from './controller';
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
  public commit: () => Callback;
  public release!: Callback;

  public active = false;
  public dependant = new Set<Listener>();
  public watch = {} as {
    [key in Model.Event<T>]: Callback | boolean;
  }

  constructor(
    target: Controller<T> | T,
    public onUpdate: Controller.OnEvent){

    const parent =
      target instanceof Controller
        ? target : ensure(target);

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
        const update = getUpdate(parent.subject);
        const applicable = update.filter(k => k in this.watch);

        UPDATE.set(proxy, applicable);

        reset = () => {
          setTimeout(() => UPDATE.delete(proxy), 0);
        }
      }

      if(notify){
        parent.waiting.add(getWhy);
        parent.waiting.add(notify);
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