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
  public dependant = new Set<{
    listen(): void;
    release(): void;
    commit?(): void;
  }>();

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

    for(const key in state)
      this.spy(key);
  }

  public listen = () => {
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

  private spy(key: string){
    const { callback, subject, proxy, metadata } = this as any;

    const intercept = () => {
      let sub: Subscriber | undefined;

      this.watch(key, () => {
        let value = subject[key];
  
        if(value instanceof Model){
          sub = new Subscriber(value, callback, metadata);

          defineProperty(proxy, key, {
            get: () => sub!.proxy,
            set: it => subject[key] = it,
            configurable: true
          })

          return sub;
        }
      });

      if(sub)
        return sub.proxy;
      else {
        this.follow(key, callback);
        delete proxy[key];
        return subject[key];
      }
    }

    alias(intercept, `tap ${key}`);
    defineProperty(this.proxy, key, {
      get: intercept,
      set: this.parent.setter(key),
      configurable: true,
      enumerable: true
    })
  }

  private follow(key: string, cb: Callback){
    if(this.metadata)
      metaData(cb, this.metadata);

    this.following[key] = cb;
  }

  public watch(
    key: string,
    setup: () => Subscriber | undefined){

    const { dependant } = this;
    let stop: Callback | undefined;

    function start(mounted?: boolean){
      const child = setup();

      if(child){
        if(mounted)
          child.listen();
        
        dependant.add(child);
  
        stop = () => {
          child.release();
          dependant.delete(child);
          stop = undefined;
        }
      }
    }

    start();

    this.follow(key, () => {
      stop && stop();
      start(true);
      this.callback();
    });
  }
}