import { Controller } from './controller';
import { LOCAL, manage, Stateful } from './model';
import { create, define, defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public active = false;
  public follows = {} as BunchOf<Callback>;
  public dependant = new Set<Listener>();
  public parent: Controller;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: Callback){

    if(!(parent instanceof Controller))
      parent = manage(parent);

    this.parent = parent;
    this.proxy = create(parent.subject);

    define(this.proxy, LOCAL, this);

    for(const key in parent.state)
      this.spy(key);
  }

  public spy(key: string){
    const { proxy } = this;

    const { set } = getOwnPropertyDescriptor(
      this.parent.subject, key
    )!

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

  public follow(key: string, cb?: Callback){
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