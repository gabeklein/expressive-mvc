import type { Controller } from './controller';

import { Subscriber } from './subscriber';
import {
  allEntriesIn,
  assign,
  defineProperty,
  entriesIn,
  fn,
  getOwnPropertyDescriptor,
  keys,
  traceable
} from './util';

import Oops from './issues';

export interface GetterInfo {
  on: Observer;
  key: string;
  priority: number;
}

const ComputedInfo = new WeakMap<Function, GetterInfo>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): typeof ComputedInfo;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    return ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export class Observer {
  public getters = new Map<string, Callback>();
  public subscribers = {} as BunchOf<Set<Callback>>;
  public waiting = [] as RequestCallback[];
  public state = {} as BunchOf<any>;

  constructor(
    public subject: {},
    base: typeof Controller){

    for(const layer of allEntriesIn(subject, base))
      for(const [key, { get, set }] of layer)
        if(get)
          this.prepareComputed(key, get, set);
  }

  public pending?: (key: string) => void;

  public get watched(){
    return keys(this.subscribers);
  }

  private prepareComputed(
    key: string,
    get?: () => any,
    set?: (v: any) => void){

    if(!get || this.getters.has(key))
      return;

    if(!set)
      set = (value: any) => {
        this.getters.delete(key);
        this.override(key, {
          value,
          configurable: true,
          writable: true
        });
      }

    traceable(`run ${key}`, get);

    this.getters.set(key, get);
    this.override(key, { get, set, configurable: true });
  }

  protected start(){
    const { state, getters, subscribers } = this;
    const expected = new Map<string, Callback>();

    for(const [k, d] of entriesIn(this.subject))
      this.manageProperty(k, d);

    for(const [key, compute] of getters){
      if(key in state)
        continue;

      const init = this.monitorComputed(key, compute);

      if(subscribers[key].size)
        expected.set(key, init);
      else
        this.override(key, {
          get: init,
          set: Oops.AssignToGetter(key).warn
        })
    }

    expected.forEach(x => x());
    this.reset([]);
  }

  protected manageProperty(
    key: string, { value, enumerable }: PropertyDescriptor){

    if(enumerable && !fn(value) || /^[A-Z]/.test(key))
      this.monitorValue(key, value);
  }

  public override(key: string, desc: PropertyDescriptor){
    defineProperty(this.subject, key, 
      assign({ enumerable: true }, desc)  
    )
  }

  public register(key: string){
    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  public monitorValue(
    key: string,
    initial: any,
    effect?: (value: any, callee?: any) => void){

    if(initial !== undefined)
      this.state[key] = initial;

    this.register(key);
    this.override(key, {
      get: this.getter(key),
      set: this.setter(key, effect)
    });
  }

  private monitorComputed(
    key: string, compute: () => any){

    this.register(key);

    const { state, subject, getters } = this;
    const info = { key, on: this, priority: 1 };

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

    const create = (early?: boolean) => {
      const { proxy, following } =
        new Subscriber(subject, refresh, info);

      try {
        defineProperty(proxy, key, { value: undefined });
        return state[key] = compute.call(proxy);
      }
      catch(e){
        Oops.ComputeFailed(subject.constructor.name, key, true).warn();

        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        for(const key of following){
          const compute = getters.get(key);
          const meta = compute && metaData(compute);

          if(meta && meta.priority >= info.priority)
            info.priority = meta.priority + 1;
        }

        this.override(key, {
          get: this.getter(key),
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    traceable(`try ${key}`, refresh);
    traceable(`new ${key}`, create);

    metaData(compute, info);
    metaData(create, info);

    return create;
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
    key: string,
    callback: Callback,
    once?: boolean){

    type Computed = (early?: boolean) => void;

    const list = this.register(key);
    const handler = once ? () => { done(); callback() } : callback;
    const done = () => { list.delete(handler) };

    const property = getOwnPropertyDescriptor(this.subject, key);
    const getter = property && property.get as Computed;

    if(getter && metaData(getter))
      getter(true);

    list.add(handler);

    return done;
  }

  public emit(key: string){
    if(!this.pending)
      this.pending = this.sync();

    this.pending(key);
  }

  private reset(frame: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(){
    const effects = new Set<Callback>();
    const handled = new Set<string>();
    const pending = [] as Callback[];

    setImmediate(() => {
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);
      
        if(!handled.has(key))
          compute();
      }

      effects.forEach(x => x());

      this.pending = undefined;
      this.reset(Array.from(handled));
    });

    return (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);

      for(const notify of this.subscribers[key] || []){
        const getter = metaData(notify);
        if(!getter || getter.on !== this)
          effects.add(notify);
        else {
          const p = metaData(notify).priority;
          const i = pending.findIndex(q => metaData(q).priority < p);
          pending.splice(i + 1, 0, notify);
        }
      }
    };
  }
}