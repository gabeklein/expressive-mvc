import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { create, define, defineProperty, displayName, within, assign } from './util';

import Oops from './issues';

export class Subscriber<T = {}> {
  public cleanup = [] as Callback[];
  public parent: Dispatch;
  public watched = [] as string[];
  
  constructor(
    public subject: T,
    private refresh: Callback,
    private metadata?: {}
  ){
    assign(refresh, metadata);
    this.parent = Dispatch.get(subject);
  }

  public get proxy(){
    const source = this.subject as any;
    const proxy = create(source);

    for(const key of this.parent.watched){
      const subscribe = () => {
        let value = source[key];

        if(value instanceof Controller)
          return this.followRecursive(key);

        this.follow(key);
        return value;
      }

      displayName(subscribe, `tap ${key}`);
      defineProperty(proxy, key, {
        configurable: true,
        set: this.parent.setter(key),
        get: subscribe
      })
    }

    define(this, { proxy });
    return proxy;
  }

  public commit(...keys: StringsOptional){
    if(keys.length == 0)
      keys.push(...this.parent.watched)

    for(const key of keys)
      delete this.proxy[key!];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  public focus(keys: StringsOptional){
    const [ key, ...rest ] = keys.filter(x => x);

    if(!key)
      return this;
      
    let sub: Subscriber | undefined;

    const reset = () => sub && sub.release();

    const monitorChild = () => {
      let value = within(this.parent.subject, key);

      if(value instanceof Controller){
        sub = new Subscriber(value, this.refresh);
        sub.focus(rest);

        this.parent.once("didRender", () => sub!.commit());
      }
      else if(rest.length)
        throw Oops.FocusIsDetatched();
  
      defineProperty(this, "proxy", {
        get: () => sub ? sub.proxy : value,
        configurable: true
      })
    }

    const onUpdate = () => {
      reset();
      monitorChild();
      this.refresh();
    }

    this.follow(key, onUpdate);
    this.cleanup.push(reset);

    monitorChild();

    return this;
  }

  protected follow(key: string, cb?: Callback){
    if(cb)
      assign(cb, this.metadata);
    else
      cb = this.refresh;

    this.watched.push(key);
    this.cleanup.push(
      this.parent.addListener(key, cb)
    )
  }

  protected followRecursive(key: string){
    const { subject } = this.parent;
    let sub: Subscriber | undefined;

    const reset = () => sub && sub.release();

    const applyChild = () => {
      let value = within(subject, key);

      if(value instanceof Controller){
        sub = new Subscriber(value, this.refresh);
        value = sub.proxy;
  
        this.parent.once("didRender", () => {
          sub!.commit();
          this.commit(key);
        });
      }

      defineProperty(this.proxy, key, {
        get: () => value,
        set: val => within(subject, key, val),
        configurable: true,
        enumerable: true
      })

      return value;
    }

    const onUpdate = () => {
      reset();
      applyChild();
      this.refresh();
    }

    this.follow(key, onUpdate);
    this.cleanup.push(reset);

    return applyChild();
  }
}