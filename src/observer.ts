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
  within,
  displayName,
  assign
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
      const compute = item.get;

      if(!compute || getters.has(key))
        continue;

      const redefine = (value: any) => {
        if(value instanceof Pending && value.loose)
          return;

        getters.delete(key);
        this.apply(key, {
          value,
          configurable: true,
          writable: true
        });
      }

      getters.set(key, compute);
      displayName(compute, `run ${key}`);
      this.apply(key, {
        set: item.set || redefine,
        get: compute
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
    const { state, getters, subscribers } = this;
    const expected = new Map<string, Callback>();

    for(const [key, compute] of getters){
      const init = this.monitorComputed(key, compute);

      if(subscribers[key].size)
        expected.set(key, init);
      else
        this.apply(key, {
          get: init,
          set: Oops.AssignToGetter(key).warn
        })
    }

    for(const [key, compute] of expected)
      if(key in state === false)
        compute();
  }

  public apply(
    key: string, desc: PropertyDescriptor){

    defineProperty(this.subject, key, 
      assign({ enumerable: true }, desc)  
    )
  }

  public monitor(key: string){
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

    this.monitor(key);
    this.apply(key, {
      get: this.getter(key),
      set: this.setter(key, effect)
    });
  }

  protected monitorComputed(
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

        this.apply(key, {
          get: this.getter(key),
          set: Oops.AssignToGetter(key).warn
        })
      }
    }

    displayName(refresh, `try ${key}`);
    displayName(create, `new ${key}`);

    metaData(compute, self);
    metaData(create, true);

    return create;
  }

  public getter(key: string){
    const get = () => this.state[key];
    displayName(get, `get ${key}`);
    return get;
  }

  public setter(
    key: string,
    effect?: (next: any, callee?: any) => void){

    const state: any = this.state;
    const set = (value: any) => {
      if(state[key] == value)
        return;

      state[key] = value;

      if(effect)
        effect(value, this.subject);

      this.emit(key);
    }

    displayName(set, `set ${key}`);
    return set;
  }

  public addListener(
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