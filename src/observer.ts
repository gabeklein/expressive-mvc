import type { Controller } from './controller';

import { Pending } from './directives';
import { Subscriber } from './subscriber';
import {
  allEntriesIn,
  defineProperty,
  entriesIn,
  getOwnPropertyDescriptor,
  fn,
  keys,
  within
} from './util';

import Oops from './issues';

interface GetterInfo {
  on: Observer;
  key: string;
  priority: number;
}

export const COMPUTED = Symbol("computed");

function metaData(x: Function): GetterInfo;
function metaData<T>(x: Function, set: T): T;
function metaData(x: Function, set?: any){
  return within(x, COMPUTED, set) as GetterInfo;
}

export class Observer {
  constructor(
    public subject: {},
    base: typeof Controller){

    this.prepare(base);
  }

  protected getters = new Map<string, Callback>();
  protected subscribers: BunchOf<Set<Callback>> = {};
  protected waiting?: ((keys: string[]) => void)[];

  public state: BunchOf<any> = {};

  public get watched(){
    return keys(this.subscribers);
  }

  protected prepare(base: typeof Controller){
    const { subject, getters } = this;

    for(const layer of allEntriesIn(subject, base))
    for(const [key, item] of layer){
      if(!item.get || getters.has(key))
        continue;

      function override(value: any){
        if(value instanceof Pending && value.loose)
          return;

        getters.delete(key);
        defineProperty(subject, key, {
          value,
          configurable: true,
          enumerable: true,
          writable: true
        })
      }

      getters.set(key, compute);
      defineProperty(subject, key, {
        configurable: true,
        set: item.set || override,
        get: item.get
      })
    }
  }

  protected manageProperties(){
    for(const [k, d] of entriesIn(this.subject))
      this.manageProperty(k, d);
  }

  protected manageProperty(
    key: string, { value, enumerable }: PropertyDescriptor){

    if(enumerable && !fn(value) || /^[A-Z]/.test(key))
      this.monitorValue(key, value);
  }

  protected manageGetters(){
    const { state, subject, getters, subscribers } = this;
    const expected = new Map<string, Callback>();

    for(const [key, compute] of getters){
      const init = this.monitorComputedValue(key, compute);

      if(subscribers[key].size)
        expected.set(key, init);
      else
        defineProperty(subject, key, {
          configurable: true,
          get: init,
          set: Oops.AssignToGetter(key).warn
        })
    }

    for(const [key, compute] of expected)
      if(key in state === false)
        compute();
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

    const { state, subject, getters } = this;
    const self = { key, on: this, priority: 1 };

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
      const meta = { [COMPUTED]: self };
      const sub = new Subscriber(subject, refresh, meta);

      try {
        return state[key] = compute.call(sub.proxy);
      }
      catch(e){
        Oops.ComputeFailed(subject.constructor.name, key, true).warn();

        if(early)
          Oops.ComputedEarly(key).warn();

        throw e;
      }
      finally {
        for(const key of sub.watched){
          const compute = getters.get(key);
          if(compute){
            const { priority } = metaData(compute);
            if(priority >= self.priority)
              self.priority = priority + 1;
          }
        }

        defineProperty(subject, key, {
          enumerable: true,
          configurable: true,
          get: () => state[key],
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    metaData(compute, self);
    metaData(create, true);

    return create;
  }

  public follow(
    key: string,
    callback: Callback,
    once?: boolean){

    type MaybeComputed = (early?: boolean) => void;

    const list = this.monitor(key);
    const stop = () => list.delete(callback);
    const property = getOwnPropertyDescriptor(this.subject, key);
    const getter = property && property.get as MaybeComputed;

    if(getter && COMPUTED in getter)
      getter(true);

    list.add(once
      ? () => { stop(); callback() }
      : callback
    );

    return stop;
  }

  public set<T>(
    key: string,
    value: T,
    effect?: (next: T, callee?: any) => void){

    const state: any =
      key in this.subscribers
        ? this.state
        : this.subject;

    if(state[key] == value)
      return;
    else
      state[key] = value;

    if(effect)
      effect(value, this.subject);

    this.emit(key);
  }

  public emit(key: string){
    const done = () => { delete (this as any).emit };
    this.emit = this.beginUpdate(done);
    this.emit(key);
  }

  private beginUpdate(done: Callback){
    const effects = new Set<Callback>();
    const handled = new Set<string>();
    let computed = [] as Callback[];

    const include = (key: string) => {
      if(handled.has(key))
        return;
      else
        handled.add(key);

      for(const notify of this.subscribers[key] || []){
        const getter = metaData(notify);
        if(!getter || getter.on !== this)
          effects.add(notify);
        else
          computed = computed
            .concat(notify)
            .sort((a, b) =>
              metaData(a).priority - metaData(b).priority
            )
      }
    }

    const commit = () => {
      while(computed.length){
        const compute = computed.shift()!;
        const { key } = metaData(compute);
      
        if(!handled.has(key))
          compute();
      }

      effects.forEach(x => x());

      const after = this.waiting;

      if(after){
        delete this.waiting;
        const list = Array.from(handled);
        after.forEach(x => x(list));
      }

      done();
    }

    setImmediate(commit);
    return include;
  }
}