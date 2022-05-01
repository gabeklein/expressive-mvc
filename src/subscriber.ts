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

    const proxy = create(parent.proxy);
    const controller = parent;

    define(proxy, LOCAL, this);
    defineProperty(this, "proxy", {
      configurable: true,
      get(){
        if(reset)
          setTimeout(reset, 0);

        return proxy;
      }
    })

    const onEvent = (key: string) => {
      const handler = this.watch[key];

      if(!handler)
        return;

      if(typeof handler == "function")
        handler();

      const notify = this.onUpdate(key, controller);
      const getWhy: RequestCallback = (keys) => {
        reset = applyUpdate(proxy, keys.filter(k => k in this.watch));
      }

      if(notify){
        controller.requestUpdate(getWhy);
        controller.requestUpdate(notify);
      }
    }

    this.commit = () => {
      const release = controller.addListener(onEvent);

      this.active = true;
      this.dependant.forEach(x => x.commit());

      return this.release = () => {
        this.dependant.forEach(x => x.release());
        release();
      }
    }
  }
}