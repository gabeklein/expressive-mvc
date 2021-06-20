import { Model, Stateful } from './model';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { alias, debounce, defineProperty, entriesIn, getOwnPropertyDescriptor, getPrototypeOf, insertAfter } from './util';

import Oops from './issues';

export type GetterInfo = {
  key: string;
  parent: Observer;
  priority: number;
}

const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedFor = new WeakMap<Observer, Map<string, GetterInfo>>();
const ComputedInit = new WeakSet<Function>();

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
  
  let scan = subject;

  while(scan !== Model && scan.constructor !== Model){
    for(let [key, { get, set }] of entriesIn(scan))
      if(get)
        prepareComputed(on, key, get, set);

    scan = getPrototypeOf(scan)
  }
}

function getRegister(on: Observer){
  let defined = ComputedFor.get(on)!;
  
  if(!defined)
    ComputedFor.set(on, defined = new Map());

  return defined;
}

export function prepareComputed(
  on: Observer,
  key: string,
  getter: (on?: any) => any,
  setter?: (to: any) => void){

  let sub: Subscriber;
  const defined = getRegister(on);
  const { state, subject } = on;

  if(defined.has(key))
    return;

  const info: GetterInfo = {
    key,
    parent: on,
    priority: 1
  };

  defined.set(key, info);

  const update = (initial?: true) => {
    try {
      const value = getter.call(sub.proxy, sub.proxy);

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

  if(!setter)
    setter = Oops.AssignToGetter(key).warn;

  for(const sub of on.listeners)
    if(key in sub){
      on.waiting.push(() => create());
      return;
    }

  ComputedInit.add(create);

  defineProperty(state, key, {
    get: create,
    configurable: true,
    enumerable: true
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