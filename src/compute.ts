import { Controller } from './controller';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { RequestCallback } from './types';
import { defineProperty, getOwnPropertyDescriptor, setAlias } from './util';

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

const INIT = new WeakSet<Function>();
const INFO = new WeakMap<Function, GetterInfo>();
const USED = new WeakMap<Controller, Map<string, GetterInfo>>();
const KEYS = new WeakMap<Controller, RequestCallback[]>();

export function prepare(
  parent: Controller,
  key: string,
  source: () => Controller,
  setter: (on?: any) => any,
  getter?: (on: Controller, key: string) => any){

  let sub: Subscriber;

  const { state, subject } = parent;
  const info: GetterInfo = { key, parent, priority: 1 };

  let register = USED.get(parent)!;

  if(!register){
    register = new Map<string, GetterInfo>();
    USED.set(parent, register);
  }

  register.set(key, info);

  function compute(initial?: boolean){
    try {
      return setter.call(sub.proxy, sub.proxy);
    }
    catch(err){
      Oops.ComputeFailed(subject, key, !!initial).warn();
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
        parent.update(key, value);
        return value;
      }
    }
  }

  function defer(_key: string, from: Controller){
    let pending = KEYS.get(from);

    if(!pending)
      KEYS.set(from, pending = []);

    if(info.parent !== from)
      update();
    else {
      const after = pending.findIndex(peer => (
        info.priority > INFO.get(peer)!.priority
      ));

      pending.splice(after + 1, 0, update);
    }
  }

  function create(early?: boolean){
    sub = new Subscriber(source(), defer);

    defineProperty(state, key, {
      value: undefined,
      writable: true
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
      sub.commit();

      for(const key in sub.watch){
        const peer = register.get(key);
    
        if(peer && peer.priority >= info.priority)
          info.priority = peer.priority + 1;
      }
    }
  }

  setAlias(update, `try ${key}`);
  setAlias(create, `new ${key}`);
  setAlias(setter, `run ${key}`);

  INIT.add(create);
  INFO.set(update, info);

  defineProperty(state, key, {
    get: create,
    configurable: true,
    enumerable: true
  })

  return getter
    ? () => getter(parent, key)
    : {};
}

export function ensure(
  on: Controller, keys: string[]){

  type Initial = (early?: boolean) => void;

  for(const key of keys){
    const desc = getOwnPropertyDescriptor(on.state, key);
    const getter = desc && desc.get;
  
    if(INIT.has(getter!))
      (getter as Initial)(true);
  }
}

export function flush(on: Controller){
  const handled = on.frame;
  const pending = KEYS.get(on);

  if(!pending)
    return;

  while(pending.length){
    const why = [ ...handled ];
    const compute = pending.shift()!;
    const { key } = INFO.get(compute)!;

    if(!handled.has(key))
      compute(why);
  }

  KEYS.delete(on);
}