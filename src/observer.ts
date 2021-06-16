import { Controllable } from './controller';
import { Model } from './model';
import { Subscriber } from './subscriber';
import {
  alias,
  createEffect,
  debounce,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  insertAfter
} from './util';

import Oops from './issues';

export type GetterInfo = {
  key: string;
  getter: () => any;
  parent: Observer;
  priority: number;
}

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedInit = new WeakSet<Function>();
const Pending = new WeakSet<Function>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): typeof ComputedInfo;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    return ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export class Observer {
  protected getters = new Map<string, GetterInfo>();
  protected waiting = [] as RequestCallback[];

  public state = {} as BunchOf<any>;
  public followers = new Set<BunchOf<RequestCallback>>();

  public pending?: (key: string) => void;

  static define(
    fn: (key: string, on: Observer) => void){

    Pending.add(fn);
    return fn as any;
  }

  constructor(public subject: Controllable){
    let scan = subject;

    while(scan !== Model && scan.constructor !== Model){
      for(let [key, desc] of entriesIn(scan))
        this.prepareComputed(key, desc);

      scan = getPrototypeOf(scan)
    }
  }

  public start(){
    const expected: (Callback | undefined)[] = [];

    for(const [key, { value, enumerable }] of entriesIn(this.subject))
      if(Pending.has(value))
        value(key, this);
      else if(enumerable && !fn(value) || /^[A-Z]/.test(key))
        this.monitorValue(key, value);

    for(const [key, compute] of this.getters)
      expected.push(
        this.monitorComputed(key, compute)
      );

    expected.forEach(x => x && x());
    this.reset();
  }

  protected prepareComputed(
    key: string,
    { get, set }: PropertyDescriptor){

    if(!get || this.getters.has(key))
      return;

    if(!set)
      set = Oops.AssignToGetter(key).warn;
    
    const info: GetterInfo = {
      key,
      getter: get,
      parent: this,
      priority: 1
    };

    alias(get, `run ${key}`);

    this.getters.set(key, info);
    this.state[key] = undefined;
    this.override(key, {
      get, set, configurable: true
    });
  }

  public override(key: string, desc: PropertyDescriptor){
    defineProperty(this.subject, key, { enumerable: true, ...desc });
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: EffectCallback<any, any>){

    this.state[key] = initial;
    this.override(key, {
      get: () => this.state[key],
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, info: GetterInfo){

    let sub: Subscriber;
    const { state, subject } = this;

    const update = (initial?: true) => {
      try {
        const value = info.getter.call(sub.proxy);

        if(state[key] == value)
          return;

        if(!initial)
          this.update(key);

        return state[key] = value;
      }
      catch(err){
        Oops.ComputeFailed(subject.constructor.name, key, false).warn();
        throw err;
      }
    }

    const create = (early?: boolean) => {
      sub = new Subscriber(subject, debounce(update), info);

      defineProperty(state, key, {
        value: undefined,
        writable: true
      })

      this.override(key, {
        get: () => state[key],
        set: Oops.AssignToGetter(key).warn
      })

      try {
        return update(true);
      }
      catch(e){
        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        sub.listen();

        for(const key in sub.following){
          const compute = this.getters.get(key);

          if(compute && compute.priority >= info.priority)
            info.priority = compute.priority + 1;
        }
      }
    }

    alias(update, `try ${key}`);
    alias(create, `new ${key}`);

    ComputedInit.add(create);

    for(const sub of this.followers)
      if(key in sub)
        return create;

    defineProperty(state, key, {
      get: create,
      configurable: true
    })

    this.override(key, {
      get: create,
      set: Oops.AssignToGetter(key).warn
    })
  }

  public setter(
    key: string,
    effect?: EffectCallback<any, any>){

    const callback =
      effect && createEffect(effect);

    return (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(callback)
        callback(value, this.subject);

      this.update(key);
    }
  }

  public watch(
    target: string | string[],
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const keys = ([] as string[]).concat(target);

    const callback = squash
      ? handler.bind(this.subject)
      : (frame: string[]) => {
        for(const key of frame)
          if(keys.includes(key))
            handler.call(this.subject, this.state[key], key);
      }

    return this.addListener(keys, callback, once);
  }

  public addListener(
    keys: Iterable<string>,
    callback: RequestCallback,
    once?: boolean){

    const remove = () => { this.followers.delete(follow) };
    const handler = once ? (k?: string[]) => { remove(); callback(k) } : callback;
    const follow: BunchOf<RequestCallback> = {};

    for(const key of keys){
      type Initial = (early?: boolean) => void;

      const desc = getOwnPropertyDescriptor(this.subject, key);
      const getter = desc && desc.get;

      if(ComputedInit.has(getter!))
        (getter as Initial)(true);

      follow[key] = handler;
    }

    this.followers.add(follow);

    return remove;
  }

  public update(key: string){
    (this.pending || this.sync())(key);
  }

  private reset(frame?: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(){
    const effects = new Set<RequestCallback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    const add = (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const subscription of this.followers)
        if(key in subscription){
          const request = subscription[key];
          const compute = metaData(request);
    
          if(!compute)
            effects.add(request);
          else if(compute.parent !== this)
            request();
          else
            insertAfter(pending, request,
              sib => compute.priority > metaData(sib).priority
            )
        }
    }

    const send = () => {
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);

        if(!handled.has(key))
          compute();
      }

      this.pending = undefined;

      const frame = Array.from(handled);
      effects.forEach(x => x(frame));
      this.reset(frame);
    }

    setTimeout(send, 0);
    return this.pending = add;
  }
}