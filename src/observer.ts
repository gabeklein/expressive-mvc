import { Model } from './model';
import { Subscriber } from './subscriber';
import {
  allEntriesIn,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  traceable
} from './util';

import Oops from './issues';

export interface GetterInfo {
  key: string;
  parent: Observer;
  priority: number;
}

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedInit = new WeakSet<Function>();

function mayComputeEarly(on: {}, key: string){
  type Compute = (early?: boolean) => void;

  const property = getOwnPropertyDescriptor(on, key);
  const getter = property && property.get as Compute;

  if(getter && ComputedInit.has(getter))
    getter(true);
}

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

  public state = {} as BunchOf<any>;
  public followers = new Set<BunchOf<Callback>>();
  public watched = new Set<string>();

  public pending?: (key: string) => void;

  constructor(
    public subject: {}){
  }

  public prepareComputed(stopAt: typeof Model){
    for(const layer of allEntriesIn(this.subject, stopAt))
      for(let [key, { get, set }] of layer){
        if(!get)
          continue;

        if(this.getters.has(key))
          return;

        if(!set)
          set = (value: any) => {
            this.getters.delete(key);
            this.assign(key, {
              value,
              configurable: true,
              writable: true
            });
          }

        traceable(`run ${key}`, get);

        this.getters.set(key, get);
        this.assign(key, { get, set, configurable: true });
      }
  }

  protected start(){
    const followers = Array.from(this.followers);
    const required: Callback[] = [];

    for(const [k, d] of entriesIn(this.subject))
      this.manageProperty(k, d);

    for(const [key, compute] of this.getters){
      if(key in this.state)
        continue;

      const init = this.monitorComputed(key, compute);

      if(followers.find(x => key in x))
        required.push(init);
      else
        this.assign(key, {
          get: init,
          set: Oops.AssignToGetter(key).warn
        })
    }

    required.forEach(x => x());
    this.reset();
  }

  protected manageProperty(
    key: string, { value, enumerable }: PropertyDescriptor){

    if(enumerable && !fn(value) || /^[A-Z]/.test(key))
      this.monitorValue(key, value);
  }

  public assign(key: string, desc: PropertyDescriptor){
    defineProperty(this.subject, key, { enumerable: true, ...desc });
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: (value: any, callee?: any) => void){

    if(initial !== undefined)
      this.state[key] = initial;

    this.watched.add(key);
    this.assign(key, {
      get: this.getter(key),
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, compute: () => any){

    const info = { key, parent: this, priority: 1 };
    const { state, subject, getters } = this;

    const refresh = () => {
      let next;

      try {
        next = compute.call(subject);
      }
      catch(err){
        Oops.ComputeFailed(subject.constructor.name, key, false).warn();
        throw err;
      }

      if(next !== state[key]){
        state[key] = next;
        this.emit(key);
      }
    }

    const initial = (early?: boolean) => {
      const sub = new Subscriber(subject, refresh, info);

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
          const compute = getters.get(key);

          if(!compute)
            continue;

          const { priority } = metaData(compute);

          if(info.priority <= priority)
            info.priority = priority + 1;
        }

        this.assign(key, {
          get: this.getter(key),
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    this.watched.add(key);

    traceable(`new ${key}`, initial);
    traceable(`try ${key}`, refresh);

    metaData(compute, info);
    ComputedInit.add(initial);

    return initial;
  }

  public getter(key: string){
    return traceable(`get ${key}`, () => this.state[key]);
  }

  public setter(
    key: string,
    effect?: (next: any, callee?: any) => void){

    const assigned = (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

      if(effect)
        effect(value, this.subject);

      this.emit(key);
    }
      
    return traceable(`set ${key}`, assigned);
  }

  public addListener(
    keys: string[],
    callback: Callback,
    once?: boolean){

    const handler = once ? () => { done(); callback() } : callback;
    const done = () => { this.followers.delete(follow) };
    const follow: BunchOf<Callback> = {};

    for(const key of keys){
      mayComputeEarly(this.subject, key);
      follow[key] = handler;
    }

    this.followers.add(follow);

    return done;
  }

  public emit(key: string){
    (this.pending || this.sync())(key);
  }

  private reset(frame?: Iterable<string>){
    const list = frame ? Array.from(frame) : [];
    this.waiting.splice(0).forEach(x => x(list));
  }

  private sync(){
    const effects = new Set<Callback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    const include = (notify: Callback) => {
      const target = metaData(notify);

      if(!target || target.parent !== this)
        effects.add(notify);
      else {
        const offset = pending.findIndex(
          sib => target.priority > metaData(sib).priority
        );
        pending.splice(offset + 1, 0, notify);
      }
    }

    setTimeout(() => {
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);

        if(!handled.has(key))
          compute();
      }

      effects.forEach(x => x());

      this.pending = undefined;
      this.reset(handled);
    }, 0);

    return this.pending = (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const group of this.followers)
        if(key in group)
          include(group[key]);
    };
  }
}