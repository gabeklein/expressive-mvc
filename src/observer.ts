import type { Controller } from './controller';

import { Pending } from './directives';
import { Subscriber } from './subscriber';
import {
  defineProperty,
  entriesIn,
  getPrototypeOf,
  isFn,
  keys,
  within,
} from './util';

import Oops from './issues';

export const COMPUTED = Symbol("is_computed");

export class Observer {
  constructor(
    public subject: {},
    base: typeof Controller){

    this.prepare(base);
  }

  public state: BunchOf<any> = {};
  protected getters: BunchOf<Callback> = {};
  protected subscribers: BunchOf<Set<Callback>> = {};
  protected pending?: Set<string>;
  protected waiting?: ((keys: string[]) => void)[];

  public get watched(){
    return keys(this.subscribers);
  }

  protected prepare(stopAt: typeof Controller){
    const { subject, getters } = this;

    for(
      let sub = subject; 
      sub.constructor !== stopAt && sub !== stopAt;
      sub = getPrototypeOf(sub))
    for(
      const [key, item] of entriesIn(sub)){

      if(!item.get || key in getters)
        continue;

      function override(value: any){
        if(value instanceof Pending && value.loose)
          return;

        delete getters[key];
        defineProperty(subject, key, {
          value,
          configurable: true,
          enumerable: true,
          writable: true
        })
      }

      defineProperty(subject, key, {
        configurable: true,
        set: item.set || override,
        get: item.get
      })

      getters[key] = item.get;
    }
  }

  protected manageProperties(){
    for(const entry of entriesIn(this.subject))
      this.manageProperty(...entry);
  }

  protected manageProperty(
    key: string, { value, enumerable }: PropertyDescriptor){

    if(enumerable && !isFn(value) || /^[A-Z]/.test(key))
      this.monitorValue(key, value);
  }

  protected manageGetters(){
    const { state, subject, getters, subscribers } = this;
    const expected = {} as BunchOf<Callback>;
  
    for(const key in getters){
      const init = this.monitorComputedValue(key, getters[key]);

      if(subscribers[key].size)
        expected[key] = init;
      else
        defineProperty(subject, key, {
          configurable: true,
          get: init,
          set: () => {
            throw Oops.AccessNotTracked(key)
          }
        })
    }

    for(const key in expected)
      if(key in state === false)
        expected[key]();
  }

  protected monitor(key: string){
    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  public monitorValue(
    key: string,
    initial: any,
    assign?: (value: any) => void){

    this.monitor(key);
    this.state[key] = initial;

    defineProperty(this.subject, key, {
      enumerable: true,
      get: () => this.state[key],
      set: assign && assign.bind(this) || (
        (value: any) => this.set(key, value)
      )
    })
  }

  protected monitorComputedValue(
    key: string, compute: () => any){

    this.monitor(key);

    const { state, subject } = this;

    const recompute = () => {
      const value = compute.call(subject);

      if(value !== state[key]){
        state[key] = value;
        this.emit(key);
      }
    }

    const initialize = (early?: boolean) => {
      try {
        const sub = new Subscriber(subject, recompute);
        const value = state[key] = compute.call(sub.proxy);
        return value;
      }
      catch(e){
        const { name } = this.subject.constructor;

        Oops.ComputeFailed(name, key).warn();

        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        defineProperty(subject, key, {
          enumerable: true,
          configurable: true,
          get: () => state[key],
          set: () => {
            throw Oops.AccessNotTracked(key)
          }
        })
      }
    }

    within(recompute, COMPUTED, true);
    within(initialize, COMPUTED, true);

    return initialize;
  }

  public set(key: string, value: any){
    let set: any = this.subject;

    if(key in this.subscribers)
      set = this.state;

    if(set[key] === value)
      return false;
    else
      set[key] = value;

    this.emit(key);
    return true;
  }

  public emit(...keys: string[]){
    if(this.pending)
      for(const x of keys)
        this.pending.add(x);
    else {
      const batch = this.pending = new Set(keys);
      setImmediate(() => {
        this.emitSync(batch);
        this.pending = undefined;
      });
    }
  }

  private emitSync(keys: Set<string>){
    const effects = new Set<Callback>();

    for(const k of keys)
      for(const notify of this.subscribers[k] || [])
        if(COMPUTED in notify)
          notify();
        else
          effects.add(notify);

    for(const effect of effects)
        effect();

    const after = this.waiting;

    if(after){
      const list = Array.from(keys);
      this.waiting = undefined;
      after.forEach(x => x(list));
    }
  }
}