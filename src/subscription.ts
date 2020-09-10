import { Controller } from './controller';
import { Observer } from './observer';
import { define, Issues } from './util';

const Oops = Issues({
  FocusIsDetatched: () => 
    `Can't do that boss`
})

export class Subscription {
  private onRelease = [] as Callback[];
  
  constructor(
    public parent: Observer,
    private refresh: Callback
  ){}

  public get proxy(){
    const { parent } = this;
    const { subject } = parent;
    const proxy = Object.create(subject);

    define(proxy, {
      get: subject,
      set: subject,
      refresh: (...keys: string[]) => {
        if(0 in keys)
          parent.emit(...keys)
        else
          this.refresh()
      }
    });

    for(const key of parent.watched)
      Object.defineProperty(proxy, key, {
        configurable: true,
        set: (value) => {
          subject[key] = value;
        },
        get: () => {
          let value = subject[key];

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
    for(const key of keys || this.parent.watched)
      delete (this.proxy as any)[key!];
  }

  public release(){
    for(const callback of this.onRelease)
      callback()
  }

  public focus(keys: maybeStrings){
    const [ key, ...rest ] = keys.filter(x => x);
    let sub: Subscription | undefined;

    if(!key)
      return this;

    const reset = () => sub && sub.release();

    const monitorChild = () => {
      let value = this.parent.subject[key];

      if(value instanceof Controller){
        sub = new Subscription(value.getDispatch(), this.refresh);
        value = sub.focus(rest).proxy;

        this.parent.once("didRender", () => sub!.commit());
      }
      else if(rest.length)
        throw Oops.FocusIsDetatched();
  
      Object.defineProperty(this, "proxy", {
        get: () => value,
        configurable: true
      })
    }

    const onUpdate = () => {
      reset();
      monitorChild();
      this.refresh();
    }

    this.follow(key, onUpdate);
    this.onRelease.push(reset);

    monitorChild();

    return this;
  }

  protected follow(key: string, cb?: Callback){
    this.onRelease.push(
      this.parent.addListener(key, cb || this.refresh)
    )
  }

  protected followRecursive(key: string){
    const { subject } = this.parent;
    let sub: Subscription | undefined;

    const reset = () => sub && sub.release();

    const applyChild = () => {
      let value = subject[key];

      if(value instanceof Controller){
        sub = new Subscription(value.getDispatch(), this.refresh);
        value = sub.proxy;
  
        this.parent.once("didRender", () => {
          sub && sub.commit();
          this.commit(key);
        });
      }

      Object.defineProperty(this.proxy, key, {
        get: () => value,
        set: val => subject[key] = val,
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
    this.onRelease.push(reset);

    return applyChild();
  }
}