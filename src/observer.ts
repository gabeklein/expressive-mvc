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

export type RequestCallback = (keys: string[]) => void;

const Updating = new WeakMap<Observer, (key: string) => void>();

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
  protected subscribers = {} as BunchOf<Set<Callback>>;
  protected waiting = [] as RequestCallback[];

  protected state = {} as BunchOf<any>;

  public get pending(){
    return Updating.has(this);
  }

  public get watched(){
    return keys(this.subscribers);
  }

  private prepare(base: typeof Controller){
    const { subject, getters } = this;

    for(const layer of allEntriesIn(subject, base))
    for(const [key, { get, set }] of layer){
      if(!get || getters.has(key))
        continue;

      displayName(get, `run ${key}`);

      const reset = (value: any) => {
        if(value instanceof Pending && value.loose)
          return;

        getters.delete(key);
        this.override(key, {
          value,
          configurable: true,
          writable: true
        });
      }

      getters.set(key, get);
      this.override(key, {
        configurable: true,
        set: set || reset,
        get: get
      })
    }
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

  protected override(key: string, desc: PropertyDescriptor){
    defineProperty(this.subject, key, 
      assign({ enumerable: true }, desc)  
    )
  }

  protected register(key: string){
    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  protected monitorValue(
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
          const meta = compute && metaData(compute);

          if(meta){
            const { priority } = meta;
            if(priority >= self.priority)
              self.priority = priority + 1;
          }
        }

        this.override(key, {
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

    const set = (value: any) => {
      if(this.state[key] == value)
        return;

      this.state[key] = value;

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

    const list = this.register(key);
    const handler =
      once ? () => { done(); callback() } : callback;
    const done = () => list.delete(handler);
    const property = getOwnPropertyDescriptor(this.subject, key);
    const getter = property && property.get as MaybeComputed;

    if(getter && COMPUTED in getter)
      getter(true);

    list.add(handler);

    return done as Callback;
  }

  public emit(key: string){
    let include = Updating.get(this);

    if(!include)
      Updating.set(this, include = 
        this.sync(list => {
          Updating.delete(this);
          this.reset(list);
        })
      );

    include(key);
  }

  private reset(frame: string[]){
    this.waiting.splice(0).forEach(x => x(frame));
  }

  private sync(done: RequestCallback){
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

      done(Array.from(handled));
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