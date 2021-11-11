import { Controller } from './controller';
import { issues } from './issues';
import { Subscriber } from './subscriber';
import { defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, getPrototypeOf, setAlias } from './util';

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
const ComputedUsed = new WeakMap<Controller, Map<string, GetterInfo>>();
const ComputedKeys = new WeakMap<Controller, Callback[]>();

function getRegister(on: Controller){
  let register = ComputedUsed.get(on);

  if(!register)
    ComputedUsed.set(on, 
      register = new Map<string, GetterInfo>()
    );

  return register;
}

export function prepareGetters(on: Controller){
  const defined = getRegister(on);

  for(
    let scan = on.subject;
    scan.constructor !== Object;
    scan = getPrototypeOf(scan)
  )
  for(const key of getOwnPropertyNames(scan)){
    const { get, set } =
      getOwnPropertyDescriptor(scan, key)!;

    if(get && !defined.has(key))
      prepare(on, key, get, set)
  }
}

export function prepare(
  control: Controller,
  key: string,
  getter: (on?: any) => any,
  setter?: (to: any) => void,
  getSource?: () => Controller){

  const { state, subject } = control;
  const defined = getRegister(control);
  const info: GetterInfo = {
    key, parent: control, priority: 1
  };

  let sub: Subscriber;

  defined.set(key, info);

  function compute(initial?: boolean){
    try {
      return getter.call(sub.proxy, sub.proxy);
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
        control.update(key, value);
        return value;
      }
    }
  }

  function create(early?: boolean){
    const source = getSource ? getSource() : control;

    sub = new Subscriber(source, update);

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
        const peer = defined.get(key);

        if(peer && peer.priority >= info.priority)
          info.priority = peer.priority + 1;
      }
    }
  }

  function revert(value: any){
    delete state[key];
    defineProperty(subject, key, {
      enumerable: true,
      configurable: true,
      value
    });
  }

  setAlias(update, `try ${key}`);
  setAlias(create, `new ${key}`);
  setAlias(getter, `run ${key}`);

  ComputedInit.add(create);

  for(const on of [state, subject])
    defineProperty(on, key, {
      get: create,
      set: setter || revert,
      configurable: true,
      enumerable: true
    })

  return info;
}

export function ensure(on: Controller, keys: string[]){
  type Initial = (early?: boolean) => void;

  for(const key of keys){
    const desc = getOwnPropertyDescriptor(on.subject, key);
    const getter = desc && desc.get;
  
    if(ComputedInit.has(getter!))
      (getter as Initial)(true);
  }
}

export function capture(on: Controller, request: RequestCallback){
  const compute = ComputedInfo.get(request);
  const callback = request as Callback;

  if(!compute)
    return;

  let pending = ComputedKeys.get(on);

  if(!pending)
    ComputedKeys.set(on, pending = []);

  if(compute.parent !== on)
    callback();
  else {
    const queue = pending.findIndex(peer =>
      compute.priority > ComputedInfo.get(peer)!.priority
    );

    pending.splice(queue + 1, 0, callback);
  }

  return true;
}

export function flush(on: Controller){
  const handled = on.frame!;
  let pending = ComputedKeys.get(on);

  if(pending){
    while(pending.length){
      const compute = pending.shift()!;
      const { key } = ComputedInfo.get(compute)!;

      if(!handled.has(key))
        compute();
    }
  
    ComputedKeys.delete(on);
  }
}