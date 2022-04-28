import { control, Controller } from './controller';
import { applyUpdate } from './dispatch';
import { LOCAL, Model, Stateful } from './model';
import { Callback, RequestCallback } from './types';
import { create, define, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber <T extends Stateful = any> {
  public proxy: T;
  public source: T;
  public parent: Controller<T>;
  public release!: Callback;
  public commit: () => () => void;

  public active = false;
  public dependant = new Set<Listener>();
  public watch = {} as {
    [key in Model.Event<T>]: Callback | true;
  }

  constructor(
    parent: Controller<T> | T,
    public onUpdate: Controller.OnEvent){

    if(!(parent instanceof Controller))
      parent = control(parent);

    this.parent = parent;
    this.source = parent.subject;

    const proxy = this.proxy = create(parent.subject);
    let reset: Callback | undefined;

    const DEBUG: RequestCallback = (keys) => {
      reset = applyUpdate(proxy, keys.filter(k => k in this.watch));
    }

    define(proxy, LOCAL, this);
    defineProperty(this, "proxy", {
      get: () => {
        if(reset)
          setTimeout(reset, 0);

        return proxy;
      }
    })

    for(const key in parent.state){
      const existing =
        getOwnPropertyDescriptor(parent.subject, key)!;

      const isUsing = () => {
        this.watch[key as Model.Field<T>] = true;
        delete proxy[key];
        return proxy[key];
      }
  
      setAlias(isUsing, `tap ${key}`);
      defineProperty(proxy, key, {
        set: existing.set,
        get: isUsing,
        configurable: true,
        enumerable: true
      })
    }

    this.commit = () => {
      const { parent } = this;

      const onDone = parent.addListener(key => {
        const handler = this.watch[key];
  
        if(!handler)
          return;
  
        if(typeof handler == "function")
          handler();
  
        const notify = this.onUpdate(key, parent);
  
        if(notify){
          parent.requestUpdate(DEBUG);
          parent.requestUpdate(notify);
        }
      });

      this.active = true;
      this.dependant.forEach(x => x.commit());

      return this.release = () => {
        this.dependant.forEach(x => x.release());
        onDone();
      }
    }
  }
}