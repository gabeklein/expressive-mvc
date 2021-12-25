import { Controller, LOCAL, manage, Stateful } from './controller';
import { create, define, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public source: any;
  public active = false;
  public follows = {} as BunchOf<RequestCallback>;
  public dependant = new Set<Listener>();
  public parent: Controller;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: RequestCallback){

    if(!(parent instanceof Controller))
      parent = manage(parent);

    this.parent = parent;
    this.source = parent.subject;
    this.proxy = create(parent.subject);

    define(this.proxy, LOCAL, this);

    for(const key in parent.state)
      this.spy(key);
  }

  public spy(key: string){
    const { proxy, source } = this;

    const { set } =
      getOwnPropertyDescriptor(source, key)!;

    const intercept = () => {
      this.follow(key);
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

  public follow(key: string, cb?: RequestCallback){
    this.follows[key] = cb || this.onUpdate;
  }

  public commit(){
    const { dependant, follows, parent } = this;

    const onDone = parent.addListener(follows);
    this.active = true;

    dependant.forEach(x => x.commit());

    return this.release = () => {
      dependant.forEach(x => x.release());
      onDone();
    }
  }

  public release!: Callback;
}