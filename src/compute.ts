import { Controller } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { defineProperty, entriesIn, getOwnPropertyDescriptor, getPrototypeOf, name, setAlias } from './util';

export const Oops = issues({
  ComputeFailed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`,

  ComputedEarly: (property) => 
    `Note: Computed values don't run until accessed, except when subscribed to. '${property}' getter may have run earlier than intended.`
})

type GetterInfo = {
  key: string;
  parent: Controller;
  priority: number;
}

const ComputedInit = new WeakSet<Function>();
const ComputedInfo = new WeakMap<Function, GetterInfo>();
const ComputedFor = new WeakMap<Controller, Map<string, GetterInfo>>();

export function implementGetters(on: Controller){
  let scan = on.subject;

  while(scan !== Model && scan.constructor !== Model){
    for(let [key, { get, set }] of entriesIn(scan))
      if(get)
        prepareComputed(on, key, get, set);

    scan = getPrototypeOf(scan)
  }
}

export function prepareComputed(
  parent: Controller,
  key: string,
  getter: (on?: any) => any,
  setter?: (to: any) => void){

  let sub: Subscriber;
  let defined = ComputedFor.get(parent)!;
  
  if(!defined)
    ComputedFor.set(parent,
      defined = new Map()  
    );

  if(defined.has(key))
    return;

  const { state, subject } = parent;
  const info: GetterInfo = {
    key, parent, priority: 1
  };

  defined.set(key, info);

  function compute(initial?: boolean){
    try {
      return getter.call(sub.proxy, sub.proxy);
    }
    catch(err){
      Oops.ComputeFailed(name(subject), key, !!initial).warn();
      throw err;
    }
  }

  function update(){
    let value;

    try {
      value = compute(false);
    }
    catch(e){
      console.error(e);
    }
    finally {
      if(state[key] !== value){
        parent.update(key);
        return state[key] = value;
      }
    }
  }

  function create(early?: boolean){
    sub = new Subscriber(parent, update);

    ComputedInfo.set(update, info);

    defineProperty(state, key, {
      value: undefined,
      writable: true
    })

    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      get: () => state[key],
      set: setter
    });

    try {
      return state[key] = compute(true);
    }
    catch(e){
      if(early)
        Oops.ComputedEarly(key).warn();

      throw e;
    }
    finally {
      sub.commit();

      for(const key in sub.follows){
        const compute = defined.get(key);

        if(compute && compute.priority >= info.priority)
          info.priority = compute.priority + 1;
      }
    }
  }

  setAlias(update, `try ${key}`);
  setAlias(create, `new ${key}`);
  setAlias(getter, `run ${key}`);

  ComputedInit.add(create);

  for(const on of [state, subject])
    defineProperty(on, key, {
      get: create,
      set: setter,
      configurable: true,
      enumerable: true
    })
}

export function ensureValue(from: {}, key: string){
  type Initial = (early?: boolean) => void;

  const desc = getOwnPropertyDescriptor(from, key);
  const getter = desc && desc.get;

  if(ComputedInit.has(getter!))
    (getter as Initial)(true);
}

export function computeContext(
  parent: Controller,
  handled: Set<string>){

  const pending = [] as Callback[];

  function queue(request: RequestCallback){
    const compute = ComputedInfo.get(request);

    if(!compute)
      return false;

    if(compute.parent !== parent)
      request();
    else
      interject(request, pending, (sib) =>
        compute.priority > ComputedInfo.get(sib)!.priority
      );

    return true;
  }

  function flush(){
    while(pending.length){
      const compute = pending.shift()!;
      const { key } = ComputedInfo.get(compute)!;

      if(!handled.has(key))
        compute();
    }
  }

  return { queue, flush };
}

function interject<T>(
  item: T, into: T[], after: (item: T) => boolean){

  into.splice(into.findIndex(after) + 1, 0, item);
}