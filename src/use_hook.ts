import { MutableRefObject, useEffect, useRef } from 'react';

import { Controller, ModelController, NEW_SUB, SUBSCRIBE, UNSUBSCRIBE } from './controller';
import { useSubscription, SpyController } from './subscriber';
import { ensureDispatch } from './subscription';
import { Class } from './types.d';
import { useState } from 'react';

const {
  defineProperty: define,
  getPrototypeOf: proto
} = Object;

export function useModelController(init: any, ...args: any[]){
  return init instanceof Controller
    ? useSubscription(init as ModelController, args)
    : useOwnController(init, args, Object.prototype);
}

export function useOwnController( 
  model: Class | Function,
  args: any[] = [],
  superType: any = Controller.prototype
): ModelController {

  const setUpdate = useState(0)[1];
  const cache = useRef(null) as MutableRefObject<any>;
  let instance = cache.current;

  const { prototype: p = {} } = model;

  const willRender = p.componentWillRender || p.willRender;
  const willUpdate = p.componentWillUpdate || p.willUpdate;
  const willUnmount = p.componentWillUnmount || p.willUnmount;
  const didMount = p.componentDidMount || p.didMount;
  const willMount = p.componentWillMount || p.willMount;

  if(instance === null){
    if(model.prototype)
      instance = new (model as Class)(...args);
    else if(typeof instance == "function")
      instance = (model as Function)(...args)
    else 
      instance = model;

    if(instance instanceof Controller == false){
      define(instance, NEW_SUB, {
        get: ensureDispatch,
        configurable: true
      })
      if(typeof instance.didInit == "function")
        instance.didInit();
    }

    if(willMount)
      willMount.call(instance);

    instance = instance[NEW_SUB](setUpdate);
  }
  else if(willUpdate)
    willUpdate.call(instance)

  if(willRender)
    willRender.call(instance)

  useEffect(() => {
    const spyControl = instance as unknown as SpyController;
    const state = proto(instance);
    
    spyControl[SUBSCRIBE]();

    if(didMount)
      didMount.call(state);

    return () => {
      if(willUnmount)
        willUnmount.call(state);

      if("willDestroy" in instance)
        instance.willDestroy();

      spyControl[UNSUBSCRIBE]();
      nuke(state);
    }
  }, [])

  return instance;
}

function nuke(target: any){
  for(const key in target)
    try { delete target[key] }
    catch(err) {}
}