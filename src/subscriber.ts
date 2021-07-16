import { GetterInfo, metaData } from './compute';
import { Controller, Stateful } from './controller';
import { Observer } from './observer';
import { alias, create, define, defineProperty } from './util';

export const LOCAL = Symbol("current_subscriber");

export class Subscriber<T extends Stateful = any> {
  private dependant = new Set<{
    listen(): void;
    release(): void;
  }>();

  public active = false;
  public following = {} as BunchOf<Callback>;
  public parent: Observer;
  public proxy: T & { [LOCAL]: Subscriber };
  
  constructor(
    public subject: T,
    protected callback: Callback,
    protected metadata?: GetterInfo){

    const { state } = this.parent = Controller.ensure(subject);

    const proxy = this.proxy = create(subject as any);

    define(this.proxy, LOCAL, this);

    for(const key in state){
      const intercept = () => {
        delete proxy[key];
        this.follow(key, this.callback);
  
        return proxy[key];
      }

      alias(intercept, `tap ${key}`);
      defineProperty(this.proxy, key, {
        get: intercept,
        set: this.parent.setter(key),
        configurable: true,
        enumerable: true
      })
    }
  }

  public listen = () => {
    this.active = true;
    this.dependant.forEach(x => x.listen());
    this.parent.listeners.add(this.following);

    // for(const key in this.proxy)
    //   delete this.proxy[key];

    return () => this.release();
  }

  public release(){
    this.dependant.forEach(x => x.release());
    this.parent.listeners.delete(this.following);
  }

  private follow(key: string, cb: Callback){
    if(this.metadata)
      metaData(cb, this.metadata);

    this.following[key] = cb;
  }
}