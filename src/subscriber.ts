import { Controller } from './controller';
import { Observer } from './observer';
import { create, define, defineProperty, within } from './util';

import Oops from './issues';

export class Subscriber {
  public cleanup = [] as Callback[];
  public parent: Observer;
  
  constructor(
    private subject: {},
    private refresh: Callback
  ){
    this.parent = Observer.get(subject);
  }

  public get proxy(){
    const master = within(this.subject);
    const proxy = create(master);

    for(const key of this.parent.watched)
      defineProperty(proxy, key, {
        configurable: true,
        set: (value) => {
          master[key] = value;
        },
        get: () => {
          let value = master[key];

          if(value instanceof Controller)
            value = this.followRecursive(key);
          else
            this.follow(key);

          return value;
        }
      })

    define(this, { proxy });
    return proxy;
  }

  public commit(...keys: maybeStrings){
    if(keys.length == 0)
      keys.push(...this.parent.watched)

    for(const key of keys)
      delete this.proxy[key!];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  public focus(keys: maybeStrings){
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
    this.cleanup.push(
      this.parent.addListener(key, cb || this.refresh)
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