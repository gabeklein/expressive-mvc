import { Controller, control } from './controller';
import { LOCAL, Stateful, UPDATE } from './model';
import { create, define, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public source: any;
  public active = false;
  public watch = {} as BunchOf<Callback | true>;
  public dependant = new Set<Listener>();
  public parent: Controller;
  public release!: Callback;
  public commit: () => () => void;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: Controller.Listen){

    if(!(parent instanceof Controller))
      parent = control(parent);

    this.parent = parent;
    this.source = parent.subject;

    const proxy = this.proxy = create(parent.subject);

    const DEBUG: RequestCallback = (keys) => {
      UPDATE.set(proxy, 
        keys.filter(k => k in this.watch)  
      );
    }

    define(proxy, LOCAL, this);
    defineProperty(this, "proxy", {
      get: () => {
        if(UPDATE.has(proxy))
          setTimeout(() => {
            UPDATE.delete(proxy);
          }, 0);

        return proxy;
      }
    })

    for(const key in parent.state){
      const existing =
        getOwnPropertyDescriptor(parent.subject, key)!;

      const isUsing = () => {
        this.watch[key] = true;
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