import type { Controller } from './controller';

import { Pending } from './directives';
import { Subscriber } from './subscriber';
import {
  defineProperty,
  entriesIn,
  getPrototypeOf,
  isFn,
  keys,
  within
} from './util';

import Oops from './issues';

export const COMPUTED = Symbol("computed");

interface GetterInfo {
  on: Observer;
  key: string;
  priority: number;
}

function meta(x: Function): GetterInfo;
function meta<T>(x: Function, set: T): T;
function meta(x: Function, set?: any){
  return within(x, COMPUTED, set) as GetterInfo;
}

export class Observer {
  constructor(
    public subject: {},
    base: typeof Controller){

    this.prepare(base);
  }

  public state: BunchOf<any> = {};
  protected getters: BunchOf<Callback> = {};
  protected subscribers: BunchOf<Set<Callback>> = {};
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

  public monitor(key: string){
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
    const self = { key, on: this, priority: 1 };

    const refresh = () => {
      const value = compute.call(subject);

      if(value !== state[key]){
        state[key] = value;
        this.emit(key);
      }
    }

    const initialize = (early?: boolean) => {
      try {
        const sub = new Subscriber(subject, refresh, { [COMPUTED]: self });
        const value = state[key] = compute.call(sub.proxy);

        for(const key of sub.watched)
          if(key in this.getters){
            const getter = meta(this.getters[key]);
            if(getter.priority >= self.priority)
              self.priority = getter.priority + 1;
          }

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

    meta(compute, self);
    meta(initialize, true);

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

  public emit(key: string){
    const effects = new Set<Callback>();
    const handled = new Set<string>();
    let computed = [] as Callback[];

    const include = (key: string) => {
      if(handled.has(key))
        return;

      handled.add(key);
      for(const notify of this.subscribers[key] || []){
        const getter = meta(notify);
        if(!getter || getter.on !== this)
          effects.add(notify);
        else
          computed = computed
            .concat(notify)
            .sort((a, b) => meta(a).priority - meta(b).priority)
      }
    };

    this.emit = include;
    include(key);

    setImmediate(() => {
      const after = this.waiting;

      while(computed.length){
        const compute = computed.shift()!;
        const { key } = meta(compute);
      
        if(!handled.has(key))
          compute();
      }

      effects.forEach(x => x());

      if(after){
        delete this.waiting;
        const list = Array.from(handled);
        after.forEach(x => x(list));
      }

      delete this.emit;
    })
  }
}