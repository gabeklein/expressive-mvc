import { issues } from './issues';
import { Model } from './model';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import { alias, defineProperty, entriesIn, getOwnPropertyDescriptor, getPrototypeOf, insertAfter } from './util';

export const Oops = issues({
  AssignToGetter: (name) => 
    `Property ${name} is only a getter. Ignoring assignment.`,

  ComputeFailed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`,

  ComputedEarly: (property) => 
    `Note: Computed values don't run until accessed, except when subscribed to. '${property}' getter may have run earlier than intended.`
})

export type GetterInfo = {
  key: string;
  parent: Observer;
  priority: number;
}

const ComputedInit = new WeakSet<Function>();
const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedFor = new WeakMap<Observer, Map<string, GetterInfo>>();

export function metaData(x: Function): GetterInfo;
export function metaData(x: Function, set: GetterInfo): void;
export function metaData(x: Function, set?: GetterInfo){
  if(set)
    ComputedInfo.set(x, set);
  else
    return ComputedInfo.get(x);
}

export function implementGetters(on: Observer){
  let scan = on.subject;

  while(scan !== Model && scan.constructor !== Model){
    for(let [key, { get, set }] of entriesIn(scan))
      if(get)
        prepareComputed(on, key, get, set);

    scan = getPrototypeOf(scan)
  }
}

export function prepareComputed(
  on: Observer,
  key: string,
  getter: (on?: any) => any,
  setter?: (to: any) => void){

  let sub: Subscriber;
  let defined = ComputedFor.get(on)!;
  
  if(!defined)
    ComputedFor.set(on,
      defined = new Map()
    );

  if(defined.has(key))
    return;

  const { state, subject } = on;

  const info: GetterInfo = {
    key,
    parent: on,
    priority: 1
  };

  defined.set(key, info);

  const compute = (initial?: boolean) => {
    try {
      return getter.call(sub.proxy, sub.proxy);
    }
    catch(err){
      Oops.ComputeFailed(subject.constructor.name, key, !!initial).warn();
      throw err;
    }
  }

  const update = () => {
    let value;

    try {
      value = compute(false);
    }
    catch(e){
      console.error(e);
    }
    finally {
      if(state[key] !== value){
        on.update(key);
        return state[key] = value;
      }
    }
  }

  const create = (early?: boolean) => {
    sub = new Subscriber(subject, update, info);

    defineProperty(state, key, {
      value: undefined,
      writable: true
    })

    on.override(key, {
      get: () => state[key],
      set: setter
    })

    try {
      return state[key] = compute(true);
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

  ComputedInit.add(create);

  const initial = {
    get: create,
    set: setter,
    configurable: true,
    enumerable: true
  }

  defineProperty(state, key, initial);
  defineProperty(subject, key, initial);
}

export function ensureValue(from: {}, key: string){
  type Initial = (early?: boolean) => void;

  const desc = getOwnPropertyDescriptor(from, key);
  const getter = desc && desc.get;

  if(ComputedInit.has(getter!))
    (getter as Initial)(true);
}

export function computeContext(
  parent: Observer,
  handled: Set<string>){

  const pending = [] as Callback[];

  return {
    queue(request: RequestCallback){
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
    },
    flush(){
      while(pending.length){
        const compute = pending.shift()!;
        const { key } = metaData(compute);
  
        if(!handled.has(key))
          compute();
      }
    }
  }
}