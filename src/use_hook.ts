import { useEffect } from 'react';

import { ensureReady } from './bootstrap';
import { Controller } from './controller';
import { createSubscription, LIFECYCLE, useManualRefresh, useSubscriber } from './subscriber';
import { Callback, Class, LifeCycle, ModelController, SpyController, SUBSCRIBE, UNSUBSCRIBE } from './types';

export function useModelController(init: any, ...args: any[]){
  return init instanceof Controller
    ? useSubscriber(init as ModelController, args, true)
    : useOwnController(init, args);
}

export function componentLifecycle(control: ModelController){
  return {
    willCycle: control.componentWillCycle || control.willCycle,
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

  const [ cache, onShouldUpdate ] = useManualRefresh();
  let control = cache.current;
  let event: LifeCycle = cache[LIFECYCLE];

  if(!control)
    if(typeof model === "function")
      control = model.prototype 
        ? new (model as Class)(...args) 
        : (model as Function)(...args)
    else 
      control = model;
      
  const willDeallocate = ensureReady(control);

  if(!cache.current){
    // cache.current = bindMethods(instance, model.prototype);
    event = cache[LIFECYCLE] = componentLifecycle(control);

    if(event.willMount)
      event.willMount.apply(control, args);

    control = cache.current = createSubscription(control, onShouldUpdate);
  }
  else 
    if(event.willUpdate)
      event.willUpdate.apply(control, args);

  if(event.willRender)
    event.willRender.apply(control, args);

  useEffect(() => {
    const spy = control as SpyController;
    let endLifecycle: Callback | undefined;
    
    spy[SUBSCRIBE]();

    if(event.willCycle)
      endLifecycle = event.willCycle.apply(control, args);

    if(event.didMount)
      event.didMount.apply(control, args);

    return () => {
      if(willDeallocate)
        willDeallocate();

      if(endLifecycle)
        endLifecycle()

      if(event.willUnmount)
        event.willUnmount.apply(control, args);

      spy[UNSUBSCRIBE]();

      if(control.willDestroy)
        control.willDestroy();
    }
  }, [])

  return control;
}