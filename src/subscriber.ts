import { GetterInfo, metaData } from './compute';
import { Controller, Stateful } from './controller';
import { Model } from './model';
import { Observer } from './observer';
import { alias, create, define, defineProperty } from './util';

export const LOCAL = Symbol("current_subscriber");

type HandleSubscriber = (subscriber?: Subscriber) => void;

export function extracts(fn: HandleSubscriber){
  return function(this: Stateful){
    return fn(this[LOCAL]);
  }
}

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

    this.proxy = create(subject as any);

    define(this.proxy, LOCAL, this);

    for(const key in state){
      const intercept = this.spy(key);

      alias(intercept, `tap ${key}`);
      defineProperty(this.proxy, key, {
        get: intercept,
        set: this.parent.setter(key),
        configurable: true,
        enumerable: true
      })
    }
  }

  private spy(key: string){
    let { callback, subject, proxy } = this as any;

    return () => {
      let sub: Subscriber | undefined;

      const setup = () => {
        let value = subject[key];
  
        if(value instanceof Model){
          sub = new Subscriber(value, callback, this.metadata);

          defineProperty(proxy, key, {
            get: () => sub!.proxy,
            set: it => subject[key] = it,
            configurable: true
          })

          return sub;
        }
      }

      const reset = this.watch(setup);

      if(sub){
        this.follow(key, reset);
        return sub.proxy;
      }
      else {
        this.follow(key, callback);
        delete proxy[key];
        return subject[key];
      }
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

  public watch(
    setup: () => Subscriber | undefined){

    let sub: Subscriber | undefined;

    const start = (mounted?: boolean) => {
      sub = setup();

      if(sub){
        this.dependant.add(sub);

        if(mounted)
          sub.listen();
      }
    }

    start();

    return () => {
      if(sub){
        sub.release();
        this.dependant.delete(sub);
        sub = undefined;
      }

      start(true);
      this.callback();
    };
  }
}