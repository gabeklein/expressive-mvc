import { useEffect, useRef, useState } from 'react';

import { bootstrapForIn, applyLiveState } from './bootstrap';
import { invokeLifecycle } from './helper';
import { Lifecycle, LiveState, State } from './types.d';

const {
  create,
  defineProperty: define,
  getOwnPropertyDescriptor: describe,
  getOwnPropertyNames: keysIn,
  getPrototypeOf: proto
} = Object;

const RESERVED = new Set([ 
  "add",
  "constructor", 
  "didMount", 
  "didHook",
  "export",
  "not",
  "on",
  "only",
  "once",
  "Provider",
  "refresh",
  "set",
  "willUnmount", 
  "willHook"
]);

function useSimpleEnclosure(){
  let cycle = {} as Lifecycle;

  return function useSimpleController(init: any, ...args: any[]){
    const update = useState(0);
    const ref = useRef(null) as any;

    let live = ref.current;

    if(live === null){
      if(!init) throw new Error(
        "use() needs some form of intializer."
      )
      live = ref.current = 
        bootstrapFromSource(
          init, args, update[1], 
          (lc: Lifecycle) => { cycle = lc }
        )
    }

    useEffect(() => {
      const { didMount, willUnmount } = cycle;
      return invokeLifecycle(live, didMount, willUnmount)
    }, [])

    return live;
  }
}

function bootstrapFromSource(
  init: any,
  args: any[],
  update: (x: any) => void,
  applyUnmount: (lc: Lifecycle) => void
){
  let base: LiveState<any> & Lifecycle;

  if(init.prototype){
    const { prototype } = init;

    base = new init(...args);

    applyUnmount({ 
      willUnmount: base.willUnmount || prototype.willUnmount, 
      didMount: base.didMount || prototype.willUnmount
    });
  }
  else {
    if(typeof init == "function")
      init = init(...args);

    const { willUnmount, didMount, ...values } = init;
    applyUnmount({ willUnmount, didMount });
    base = values;
  }

  applyLiveState(base, update);
  bootstrapForIn(base);

  if(init.prototype)
    base = bindMethods(base, init.prototype);

  return base as State & LiveState;
}

export function bindMethods(
  instance: any, 
  prototype: any, 
  stopAt: any = Object.prototype){

  const boundLayer = create(instance);
  const chain = [];

  while(prototype !== stopAt){
    chain.push(prototype);
    prototype = proto(prototype);
  }

  prototype = {};
  for(const methods of chain){
    for(const key of keysIn(methods)){
      if(RESERVED.has(key))
        continue;
      const { value } = describe(methods, key)!;
      if(typeof value === "function")
        prototype[key] = value
    }
  } 

  for(const key in prototype)
    define(boundLayer, key, {
      value: prototype[key].bind(instance),
      writable: true
    })

  for(const key of ["get", "set"])
    define(boundLayer, key, {
      value: instance,
      writable: true
    })

  return boundLayer
}

export const use = useSimpleEnclosure()