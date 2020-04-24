import {  MutableRefObject, useEffect, useRef } from 'react';

import { Controller } from './controller';
import { createSubscription, useRefresh, useSubscriber } from './subscriber';
import { Class, ModelController, SpyController, SUBSCRIBE, UNSUBSCRIBE, Callback } from './types';
import { ensureBootstrap, bindMethods, nuke } from './bootstrap';

const {
  getPrototypeOf: prototypeOf
} = Object;

export function useModelController(init: any, ...args: any[]){
  return init instanceof Controller
    ? useSubscriber(init as ModelController, args, true)
    : useOwnController(init, args);
}

export function componentLifecycle(control: ModelController){
  return {
    willExist: control.componentWillExist || control.willExist,
    willRender: control.componentWillRender || control.willRender,
    willUpdate: control.componentWillUpdate || control.willUpdate,
    willUnmount: control.componentWillUnmount || control.willUnmount,
    willMount: control.componentWillMount || control.willMount,
    didMount: control.componentDidMount || control.didMount
  }
}

export function useOwnController( 
  model: Class | Function,
  args: any[] = []
): ModelController {

  const setUpdate = useRefresh();
  const cache = useRef(null) as MutableRefObject<any>;
  let instance = cache.current;
  let endLifecycle: Callback | undefined;

  const p: ModelController = model.prototype || {};

  const {
    willRender,
    willUpdate,
    willUnmount,
    didMount,
    willMount,
    willExist
  } = componentLifecycle(p);

  if(instance === null)
    if(typeof model === "function"){
      if(model.prototype){
        instance = new (model as Class)(...args);
        if(!model.prototype.cache)
          model.prototype.cache = {}
      }
      else 
        instance = (model as Function)(...args)
    }
    else 
      instance = model;
      
  const willDeallocate = ensureBootstrap(instance);

  if(cache.current === null){
    cache.current = bindMethods(instance, model.prototype);
    
    if(instance.didInit && !(instance instanceof Controller))
      instance.didInit();

    if(willMount)
      willMount.apply(instance, args);

    if(willRender)
      willRender.apply(instance, args);

    instance = createSubscription(instance, setUpdate);
  }
  else {
    // TODO: return Spycontroller always
    instance = Object.create(instance);

    if(willUpdate)
      willUpdate.apply(instance, args);

    if(willRender)
      willRender.apply(instance, args);
  }

  Object.defineProperty(instance, "refresh", {
    value: (...keys: string[]) => {
      if(!keys[0]) setUpdate();
      else return cache.current.refresh(...keys)
    }
  })

  useEffect(() => {
    const spyControl = instance as unknown as SpyController;
    const state = prototypeOf(instance);
    
    spyControl[SUBSCRIBE]();

    if(willExist)
      endLifecycle = willExist.apply(state, args);

    if(didMount)
      didMount.apply(state, args);

    return () => {
      if(endLifecycle)
        endLifecycle()

      if(willUnmount)
        willUnmount.apply(state, args);

      if("willDestroy" in instance)
        instance.willDestroy();

      if(willDeallocate)
        willDeallocate();

      spyControl[UNSUBSCRIBE]();
      nuke(state);
    }
  }, [])

  return instance;
}