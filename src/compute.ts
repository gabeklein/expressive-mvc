import { Controller } from './controller';
import { issues } from './issues';
import { Subscriber } from './subscriber';
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
  getter?: (value: any, key: string) => any){

  let sub: Subscriber;

  const { state, subject } = parent;
  const info: GetterInfo = { key, parent, priority: 1 };

  let register = USED.get(parent)!;

  if(!register){
    register = new Map<string, GetterInfo>();
    USED.set(parent, register);
  }

  register.set(key, info);

  const current = getter
    ? () => getter.call(subject, state[key], key)
    : () => state[key];

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

  function create(early?: boolean){
    sub = new Subscriber(source(), update);

    defineProperty(state, key, {
      value: undefined,
      writable: true
    })

    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      get: current
    });

    try {
      state[key] = compute(true);
    }
    catch(e){
      if(early)
        Oops.ComputedEarly(key).warn();

      throw e;
    }
    finally {
      sub.commit();

      for(const key in sub.follows){
        const peer = register.get(key);
    
        if(peer && peer.priority >= info.priority)
          info.priority = peer.priority + 1;
      }
    }

    return current();
  }

  setAlias(update, `try ${key}`);
  setAlias(create, `new ${key}`);
  setAlias(setter, `run ${key}`);

  INIT.add(create);
  INFO.set(update, info);

  for(const on of [state, subject])
    defineProperty(on, key, {
      get: create,
      configurable: true,
      enumerable: true
    })
}

export function ensure(on: Controller, keys: string[]){
  type Initial = (early?: boolean) => void;

  for(const key of keys){
    const desc = getOwnPropertyDescriptor(on.subject, key);
    const getter = desc && desc.get;
  
    if(INIT.has(getter!))
      (getter as Initial)(true);
  }
}

export function defer(on: Controller, request: RequestCallback){
  const compute = INFO.get(request);

  if(!compute)
    return;

  let pending = KEYS.get(on);

  if(!pending)
    KEYS.set(on, pending = []);

  if(compute.parent !== on)
    request([]);
  else {
    const after = pending.findIndex(peer => (
      compute.priority > INFO.get(peer)!.priority
    ));

    pending.splice(after + 1, 0, request);
  }

  return true;
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