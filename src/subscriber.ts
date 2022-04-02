import { Controller, LOCAL, manage, Stateful, UPDATE } from './controller';
import { create, define, defineLazy, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public source: any;
  public active = false;
  public handle = {} as BunchOf<Callback | true>;
  public dependant = new Set<Listener>();
  public parent: Controller;
  public notify?: RequestCallback;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: Controller.Listen){

    if(!(parent instanceof Controller))
      parent = manage(parent);

    this.parent = parent;
    this.source = parent.subject;
    this.proxy = create(parent.subject);

    define(this.proxy, LOCAL, this);
    defineLazy(this.proxy, UPDATE, this.debug);

    for(const key in parent.state)
      this.spy(key);
  }

  public debug = () => {
    const update: string[] = [];

    this.notify = keys => {
      update.splice(0, update.length,
        ...keys.filter(k => k in this.handle)  
      )
    }

    return update;
  }

  public listen = (key: string, from: Controller) => {
    const handler = this.handle[key];

    if(!handler)
      return;

    if(typeof handler == "function")
      handler();

    const notify = this.onUpdate(key, from);

    if(notify)
      from.waiting.add(notify);

    if(this.notify)
      from.waiting.add(this.notify);
  }

  public spy(key: string){
    const { proxy, source } = this;

    const { set } =
      getOwnPropertyDescriptor(source, key)!;

    const intercept = () => {
      this.handle[key] = true;
      delete proxy[key];
      return proxy[key];
    }

    setAlias(intercept, `tap ${key}`);
    defineProperty(proxy, key, {
      get: intercept,
      set,
      configurable: true,
      enumerable: true
    })
  }

  public commit(){
    const onDone =
      this.parent.addListener(this.listen);

    this.active = true;

    this.dependant.forEach(x => x.commit());

    return this.release = () => {
      this.dependant.forEach(x => x.release());
      onDone();
    }
  }

  public release!: Callback;
}