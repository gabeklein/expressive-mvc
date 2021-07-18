import { GetterInfo, metaData } from './compute';
import { Controller, Stateful } from './controller';
import { Observer } from './observer';
import { alias, create, define, defineProperty } from './util';

export const LOCAL = Symbol("current_subscriber");

export class Subscriber<T extends Stateful = any> {
  public active = false;
  public following = {} as BunchOf<Callback>;
  public parent: Observer;
  public proxy: T & { [LOCAL]: Subscriber };
  public dependant = new Set<{
    listen(): void;
    release(): void;
  }>();
  
  constructor(
    public subject: T,
    public callback: Callback,
    public info?: GetterInfo){

    const { state } = this.parent =
      Controller.ensure(subject);

    this.proxy = create(subject);

    define(this.proxy, LOCAL, this);

    for(const key in state)
      this.spy(key);
  }

  public spy(key: string){
    const { proxy } = this as any;

    const intercept = () => {
      delete proxy[key];
      this.follow(key, this.callback);

      return proxy[key];
    }

    alias(intercept, `tap ${key}`);
    defineProperty(proxy, key, {
      get: intercept,
      set: this.parent.setter(key),
      configurable: true,
      enumerable: true
    })
  }

  public follow(key: string, cb: Callback){
    if(this.info)
      metaData(cb, this.info);

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