import { Controller } from './controller';
import { globalController } from './global';
import { useSubscription, ModelEvent } from './subscription';
import { Class, ModelController } from './types';
import { dedent } from './util';

const subscriberLifecycle = {
  willCycle: "elementWillCycle",
  willRender: "elementWillRender",
  willUpdate: "elementWillUpdate",
  willUnmount: "elementWillUnmount",
  didMount: "elementDidMount",
  willMount: "elementWillMount"
}

const componentLifecycle = {
  willCycle: "componentWillCycle",
  willRender: "componentWillRender",
  willUpdate: "componentWillUpdate",
  willUnmount: "componentWillUnmount",
  willMount: "componentWillMount",
  didMount: "componentDidMount"
}

export function useModelController(init: any, ...args: any[]){
  if(init instanceof Controller){
    const instance = init as ModelController;
    return useSubscriber(instance, args, true)
  }
  if(init.global){    
    const instance = globalController(init, args);
    return useSubscriber(instance, args, true);
  }
  else
    return useOwnController(init, args);
}

export function useOwnController(
  model: Class | Function,
  args: any[] = [],
  callback?: (self: Controller) => void
){
  let lifecycle: any = componentLifecycle;

  return useSubscription(
    () => {
      const control = 
        typeof model === "function" ?
          model.prototype ?
            new (model as Class)(...args) :
            (model as Function)(...args) :
          model;

      if(callback)
        callback(control);

      return control;
    },
    (event, controller) => {
      const specific: ModelEvent = lifecycle[event];
      const handler = controller[event] || controller[specific];
  
      if(event == "willUnmount")
        if(controller.willDestroy)
          controller.willDestroy(...args)
  
      if(handler)
        return handler.apply(controller, args);
    }
  );
}

export function useSubscriber(
  target: ModelController, 
  args: any[], 
  main: boolean
){
  let lifecycle: any = main ? 
    componentLifecycle : 
    subscriberLifecycle;

  return useSubscription(
    () => target,
    (event, controller) => {
      const specific: ModelEvent = lifecycle[event];
      const handler = controller[event] || controller[specific];

      //TODO: callback caching breaks this!
      if(event == "willUpdate"){
        const current = Object.getPrototypeOf(controller);
        if(target !== current)
          instanceIsUnexpected(target, current);
      }

      if(handler)
        return handler.apply(controller, args);
    }
  );
}

function instanceIsUnexpected(
  control: ModelController, cached: ModelController){

  const ControlType = cached.constructor;

  if(control instanceof ControlType)
    console.warn(dedent`
      Unexpected Instance:
      use() received unexpected instance of ${ControlType.name}!
      This should not change between renders of the same component. 
      Force a remount instead using key props.
    `)
  else
    throw new Error(dedent`
      Unexpected Controller:
      use() received unexpected controller between renders!
      Expected ${ControlType.name} and got ${control.constructor.name}!
      This should never happen; force a remount where a passed controller may change.
    `)
}

