import { Model } from './model';
import { Subscriber } from './subscriber';
import {
  alias,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  insertAfter
} from './util';

import Oops from './issues';

export interface GetterInfo {
  key: string;
  parent: Observer;
  priority: number;
}

/**
 * *Placeholder Type.*
 * 
 * Depending on `squash` parameter, will by default accept
 * value+key or expect no parameters if set to true.
 **/
type EventCallback = Function;
type Init = (key: string, on: Observer) => void;
type InitCompute = (early?: boolean) => void;

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedInit = new WeakSet<Function>();
const Pending = new WeakSet<Init>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): typeof ComputedInfo;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    return ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export class Observer {
  protected getters = new Map<string, Callback>();
  protected waiting = [] as RequestCallback[];

  public active = false;
  public state = {} as BunchOf<any>;
  public followers = new Set<BunchOf<RequestCallback>>();
  public watched = new Set<string>();

  public pending?: (key: string) => void;

  static define(fn: Init){
    Pending.add(fn);
    return fn as any;
  }

  constructor(public subject: {}){
    this.prepareComputed();
  }

  public start(){
    this.active = true;

    for(const [key, { value, enumerable }] of entriesIn(this.subject))
      if(Pending.has(value))
        value(key, this);
      else if(enumerable && !fn(value) || /^[A-Z]/.test(key))
        this.monitorValue(key, value);

    this.initComputed();
    this.reset([]);
  }

  private prepareComputed(){
    for(
      let scan = this.subject;
      scan !== Model && scan.constructor !== Model;
      scan = getPrototypeOf(scan)){

      for(let [key, { get, set }] of entriesIn(scan)){
        if(!get || this.getters.has(key))
          continue;

        if(!set)
          set = (value: any) => {
            this.getters.delete(key);
            this.assign(key, {
              value,
              configurable: true,
              writable: true
            });
          }

        alias(get, `run ${key}`);

        this.getters.set(key, get);
        this.assign(key, { get, set, configurable: true });
      }
    }
  }

  protected initComputed(){
    const expected: Callback[] = [];

    for(const [key, compute] of this.getters){
      if(key in this.state)
        continue;

      const init =
        this.monitorComputed(key, compute);

      if(init)
        expected.push(init);
    }

    for(const init of expected)
      init();
  }

  public assign(key: string, desc: PropertyDescriptor){
    this.watched.add(key);
    defineProperty(this.subject, key, { enumerable: true, ...desc });
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: (value: any, callee?: any) => void){

    if(initial !== undefined)
      this.state[key] = initial;

    this.assign(key, {
      get: this.getter(key),
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, compute: () => any){

    const self = this;
    const { state, subject } = this;
    const info = { key, parent: this, priority: 1 };

    function next(){
      let output;

      try {
        output = compute.call(subject);
      }
      catch(err){
        Oops.ComputeFailed(subject.constructor.name, key, false).warn();
        throw err;
      }

      if(output !== state[key]){
        state[key] = output;
        self.update(key);
      }
    }

    function init(early?: boolean){
      const sub = new Subscriber(subject, next, info);

      try {
        defineProperty(sub.proxy, key, { value: undefined });

        return state[key] = compute.call(sub.proxy);
      }
      catch(e){
        Oops.ComputeFailed(subject.constructor.name, key, true).warn();

        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        sub.listen();

        for(const key in sub.following){
          const compute = self.getters.get(key);

          if(!compute)
            continue;

          const { priority } = metaData(compute);

          if(info.priority <= priority)
            info.priority = priority + 1;
        }

        self.assign(key, {
          get: self.getter(key),
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    alias(init, `new ${key}`);
    alias(next, `try ${key}`);

    metaData(compute, info);
    self.watched.add(key);
    ComputedInit.add(init);

    for(const sub of self.followers)
      if(key in sub)
        return init;

    defineProperty(state, key, {
      configurable: true,
      get: init,
      set: to => defineProperty(state, key, {
        writable: true,
        value: to
      })
    })

    this.assign(key, {
      get: init,
      set: Oops.AssignToGetter(key).warn
    })
  }

  public getter(key: string){
    return alias(() => this.state[key], `get ${key}`);
  }

  public setter(
    key: string,
    effect?: (next: any, callee?: any) => void){

    const assign = (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(effect)
        effect(value, this.subject);

      this.update(key);
    }
      
    return alias(assign, `set ${key}`);
  }

  public watch(
    target: string | string[],
    handler: EventCallback,
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

    const remove = () => this.followers.delete(follow);
    const handler = once ? (k: string[]) => { remove(); callback(k) } : callback;
    const follow: BunchOf<RequestCallback> = {};

    for(const key of keys){
      const desc = getOwnPropertyDescriptor(this.subject, key);
      const getter = desc && desc.get;

      if(ComputedInit.has(getter!))
        (getter as InitCompute)(true);

      follow[key] = handler;
    }

    this.followers.add(follow);

    return remove;
  }

  public update(key: string){
    (this.pending || this.sync())(key);
  }

  private reset(frame: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(){
    const local = this;
    const effects = new Set<RequestCallback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    function add(key: string){
      if(handled.has(key))
        return;

      handled.add(key);

      for(const sub of local.followers)
        if(key in sub)
          include(sub[key]);
    }

    function include(request: RequestCallback){
      const self = metaData(request);

      if(self && self.parent == local)
        insertAfter(pending, request,
          sib => self.priority > metaData(sib).priority
        )
      else
        effects.add(request);
    }

    function notify(){
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);

        if(!handled.has(key))
          compute();
      }

      const frame = Array.from(handled);

      effects.forEach(x => x(frame));

      local.pending = undefined;
      local.reset(frame);
    }

    setTimeout(notify, 0);
    return this.pending = add;
  }
}