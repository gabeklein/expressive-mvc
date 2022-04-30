import { control, Controller } from './controller';
import { applyUpdate } from './dispatch';
import { LOCAL, Model, Stateful } from './model';
import { Callback, RequestCallback } from './types';
import { create, define, defineProperty } from './util';

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
    [key in Model.Event<T>]: Callback | true;
  }

  constructor(
    parent: Controller<T> | T,
    public onUpdate: Controller.OnEvent){

    if(!(parent instanceof Controller))
      parent = control(parent);

    let reset: Callback | undefined;

    const DEBUG: RequestCallback = (keys) => {
      reset = applyUpdate(proxy, keys.filter(k => k in this.watch));
    }

    const proxy = create(parent.proxy);

    define(proxy, LOCAL, this);
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        if(reset)
          setTimeout(reset, 0);

        return proxy;
      }
    })

    this.commit = () => {
      const control = parent as Controller;
      const onDone = control.addListener(key => {
        const handler = this.watch[key];
  
        if(!handler)
          return;
  
        if(typeof handler == "function")
          handler();
  
        const notify = this.onUpdate(key, control);
  
        if(notify){
          control.requestUpdate(DEBUG);
          control.requestUpdate(notify);
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