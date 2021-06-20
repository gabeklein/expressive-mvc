import { Model, Stateful } from './model';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { alias, debounce, defineProperty, entriesIn, getOwnPropertyDescriptor, getPrototypeOf, insertAfter } from './util';

import Oops from './issues';

export type GetterInfo = {
  key: string;
  getter: () => any;
  parent: Observer;
  priority: number;
}

export const ComputedInfo = new WeakMap<Function, GetterInfo>();
export const ComputedFor = new WeakMap<Observer, Map<string, GetterInfo>>();
export const ComputedInit = new WeakSet<Function>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): void;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export function implementGetters(
  on: Observer, subject: Stateful){
  
  const defined = new Map<string, GetterInfo>();
  let scan = subject;

  while(scan !== Model && scan.constructor !== Model){
    for(let [key, desc] of entriesIn(scan))
      prepareComputed(on, key, desc, defined)

    scan = getPrototypeOf(scan)
  }
}

export function prepareComputed(
  on: Observer,
  key: string,
  desc: PropertyDescriptor,
  defined: Map<string, GetterInfo>){

  let sub: Subscriber;
  let { get: getter, set: setter } = desc;
  const { state, subject } = on;

  if(!getter || defined.has(key))
    return;

  if(!setter)
    setter = Oops.AssignToGetter(key).warn;
  
  const info: GetterInfo = {
    key,
    getter: getter,
    parent: on,
    priority: 1
  };

  defined.set(key, info);
  on.state[key] = undefined;

  const update = (initial?: true) => {
    try {
      const value = info.getter.call(sub.proxy);

      if(state[key] == value)
        return;

      if(!initial)
        on.update(key);

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

    on.override(key, {
      get: () => state[key],
      set: setter
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
        const compute = defined.get(key);

        if(compute && compute.priority >= info.priority)
          info.priority = compute.priority + 1;
      }
    }
  }

  alias(update, `try ${key}`);
  alias(create, `new ${key}`);
  alias(getter, `run ${key}`);

  for(const sub of on.listeners)
    if(key in sub){
      on.waiting.push(() => create());
      return;
    }

  ComputedInit.add(create);

  defineProperty(state, key, {
    get: create,
    configurable: true
  })

  on.override(key, {
    get: create,
    set: setter,
    configurable: true
  })
}

export function ensureValue(on: {}, key: string){
  type Initial = (early?: boolean) => void;

  const desc = getOwnPropertyDescriptor(on, key);
  const getter = desc && desc.get;

  if(ComputedInit.has(getter!))
    (getter as Initial)(true);
}

export function computeContext(
  parent: Observer,
  handled: Set<string>){

  const pending = [] as Callback[];

  function isComputed(request: RequestCallback){
    const compute = metaData(request);

    if(!compute)
      return false;

    if(compute.parent !== parent)
      request();
    else
      insertAfter(pending, request,
        sib => compute.priority > metaData(sib).priority
      )

    return true;
  }

  function flushComputed(){
    while(pending.length){
      const compute = pending.shift()!;
      const { key } = metaData(compute);

      if(!handled.has(key))
        compute();
    }
  }

  return {
    isComputed,
    flushComputed
  }
}