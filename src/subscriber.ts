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
    let { proxy, subject } = this as any;

    return () => {
      let onUpdate = this.callback;
      let value: any;

      const setup = () => {
        value = subject[key];
  
        if(value instanceof Model){
          const update = this.callback;
          const sub = new Subscriber(value, update, this.metadata);
          const reset = sub.attach(this);

          defineProperty(proxy, key, {
            get: () => sub.proxy,
            set: it => subject[key] = it,
            configurable: true
          })

          value = sub.proxy;
          onUpdate = () => {
            reset();
            setup();
            update();
          }
        }
        else
          delete proxy[key];
      }
  
      setup();
      this.follow(key, () => onUpdate());

      return value;
    }
  }

  public attach(to: Subscriber){
    to.dependant.add(this);

    if(to.active)
      this.listen();

    return () => {
      this.release();
      to.dependant.delete(this);
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