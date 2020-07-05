import { Controller } from './controller';
import { ensureDispatch } from './dispatch';
import { globalController } from './global';
import { useEventDrivenController } from './hook';
import { ensurePeerControllers } from './peers';
import { createSubscription } from './subscription';
import { Callback, Class, LivecycleEvent } from './types';

const subscriberLifecycle: any = {
  willCycle: "elementWillCycle",
  willRender: "elementWillRender",
  willUpdate: "elementWillUpdate",
  willUnmount: "elementWillUnmount",
  didMount: "elementDidMount",
  willMount: "elementWillMount"
}

const componentLifecycle: any = {
  willCycle: "componentWillCycle",
  willRender: "componentWillRender",
  willUpdate: "componentWillUpdate",
  willUnmount: "componentWillUnmount",
  willMount: "componentWillMount",
  didMount: "componentDidMount"
}

export const lifecycleEvents = [
  ...Object.keys(subscriberLifecycle),
  ...Object.entries(subscriberLifecycle),
  ...Object.entries(componentLifecycle)
]

export function use(init: any, ...args: any[]){
  return useModelController(init, args);
}

export function useModelController(
  init: any, 
  args: any[] = [], 
  callback?: (instance: Controller) => void){

  return useEventDrivenController((refresh) => {
    let instance: Controller;
    let lifecycle = componentLifecycle;
    let release: Callback | undefined;

    if(init instanceof Controller){
      lifecycle = subscriberLifecycle;
      instance = init;
    }
    else if(init.global)
      instance = globalController(init, args);
    else
      instance = newController(init, args);

    const dispatch = ensureDispatch(instance);

    if(callback)
      callback(instance);

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = lifecycle[name] as LivecycleEvent;
      const handler = instance[specific] || instance[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.forceRefresh(name, specific);

      switch(name){
        case "willRender":
          release = ensurePeerControllers(this);
        break;

        case "willUnmount": {
          if(release)
            release();

          if(lifecycle == componentLifecycle)
            if(instance.willDestroy)
              instance.willDestroy(...args)
        }
        break;
      }
    }

    return createSubscription(instance, refresh, onEvent);
  })
}

export function useSubscriber(
  target: Controller,
  args: any[],
  main: boolean){

  return useEventDrivenController((refresh) => {
    const lifecycle: any = main
      ? componentLifecycle
      : subscriberLifecycle;

    const dispatch = ensureDispatch(target);

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = lifecycle[name] as LivecycleEvent;
      const handler = target[specific] || target[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.forceRefresh(name, specific);
    }
    
    return createSubscription(target, refresh, onEvent)
  })
}

export function newController(
  model: Class | Function,
  args: any[] = [],
  callback?: (self: Controller) => void
){
  const control = 
    typeof model === "function" ?
      model.prototype ?
        new (model as Class)(...args) :
        (model as Function)(...args) :
      model;

  if(callback)
    callback(control);

  return control
}

// function instanceIsUnexpected(
//   control: ModelController, cached: ModelController){

//   const ControlType = cached.constructor;

//   if(control instanceof ControlType)
//     console.warn(dedent`
//       Unexpected Instance:
//       use() received unexpected instance of ${ControlType.name}!
//       This should not change between renders of the same component. 
//       Force a remount instead using key props.
//     `)
//   else
//     throw new Error(dedent`
//       Unexpected Controller:
//       use() received unexpected controller between renders!
//       Expected ${ControlType.name} and got ${control.constructor.name}!
//       This should never happen; force a remount where a passed controller may change.
//     `)
// }