import { GetterInfo, metaData } from './compute';
import { LOCAL } from './model';
import { Observer } from './observer';
import { create, define, defineProperty, setAlias } from './util';

type Listener = {
  listen(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public meta?: GetterInfo;

  public active = false;
  public following = {} as BunchOf<Callback>;
  public dependant = new Set<Listener>();

  constructor(
    public parent: Observer,
    public callback: Callback){

    const { state, subject } = parent;

    this.proxy = create(subject);

    define(this.proxy, LOCAL, this);

    for(const key in state)
      this.spy(key);
  }

  public spy(key: string){
    const { proxy } = this;

    const intercept = () => {
      this.follow(key, this.callback);
      delete proxy[key];
      return proxy[key];
    }

    setAlias(intercept, `tap ${key}`);
    defineProperty(proxy, key, {
      get: intercept,
      set: this.parent.setter(key),
      configurable: true,
      enumerable: true
    })
  }

  public follow(key: string, cb: Callback){
    if(this.meta)
      metaData(cb, this.meta);

    this.following[key] = cb;
  }

  public listen = () => {
    this.active = true;
    this.dependant.forEach(x => x.listen());
    this.parent.listeners.add(this.following);

    return () => this.release();
  }

  public release(){
    this.dependant.forEach(x => x.release());
    this.parent.listeners.delete(this.following);
  }
}