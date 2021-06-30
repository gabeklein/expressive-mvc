import { GetterInfo, metaData } from './compute';
import { Controller, Stateful } from './controller';
import { Model } from './model';
import { Observer } from './observer';
import { alias, create, define, defineProperty } from './util';

export const LOCAL = Symbol("current_subscriber");

export class Subscriber<T extends Stateful = any> {
  /** Assuming argument is actually a proxy, get the current subscription. */
  static current(on: Stateful){
    return on[LOCAL];
  }

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
      this.spyOn(key);
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

  private spyOn(key: string){
    const access = () => {
      let value = (this.subject as any)[key];

      if(value instanceof Model)
        return this.delegate(key);

      this.follow(key, this.callback);
      delete (this.proxy as any)[key];
      return value;
    }

    alias(access, `tap ${key}`)
    defineProperty(this.proxy, key, {
      get: access,
      set: this.parent.setter(key),
      configurable: true
    })
  }

  private follow(key: string, cb: Callback){
    if(this.metadata)
      metaData(cb, this.metadata);

    this.following[key] = cb;
  }

  public recursive(
    key: string,
    onUpdate: () => Subscriber | undefined){

    let child: Subscriber | undefined;

    const start = (mounted?: boolean) => {
      child = onUpdate();

      if(child){
        this.dependant.add(child);
  
        if(mounted)
          child.listen();
      }
    }

    const reset = () => {
      if(child){
        child.release();
        this.dependant.delete(child);
      }

      start(true);
      this.callback();
    }

    this.follow(key, reset);
    start();
  }

  private delegate(key: string){
    let sub: Subscriber | undefined;

    this.recursive(key, () => {
      let value = (this.subject as any)[key];

      if(value instanceof Model){
        let child = sub = new Subscriber(
          value, this.callback, this.metadata
        );

        defineProperty(this.proxy, key, {
          get: () => child.proxy,
          set: it => (this.subject as any)[key] = it,
          configurable: true
        })

        return child;
      }
    });

    return sub && sub.proxy;
  }
}