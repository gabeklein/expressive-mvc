import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { useGlobalController } from './global';
import { useSubscription } from './subscription';
import { Class, ModelController } from './types';
import { dedent } from './util';

function subscriberLifecycle(control: ModelController){
  return {
    willCycle: control.elementWillCycle || control.willCycle,
    willRender: control.elementWillRender || control.willRender,
    willUpdate: control.elementWillUpdate || control.willUpdate,
    willUnmount: control.elementWillUnmount || control.willUnmount,
    didMount: control.elementDidMount || control.didMount,
    willMount: control.elementWillMount || control.willMount
  }
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

export function useModelController(init: any, ...args: any[]){
  if(init instanceof Controller)
    return useSubscriber(init as ModelController, args, true)
  if(init.global)
    return useGlobalController(init, args)
  else
    return useOwnController(init, args);
}

export function useOwnController(
  model: Class | Function,
  args: any[] = []
){
  let lifecycle: any;

  return useSubscription(
    () => {
      const control = 
        typeof model === "function" ?
          model.prototype ?
            new (model as Class)(...args) :
            (model as Function)(...args) :
          model;
  
      lifecycle = componentLifecycle(control);
      Dispatch.readyFor(control);
  
      return control;
    },
    (name: string, on: ModelController) => {
      const handler = lifecycle[name];
  
      if(name == "willUnmount")
        if(on.willDestroy)
          on.willDestroy(...args)
  
      if(handler)
        return handler.apply(on, args);
    }
  );
}

export function useSubscriber(
  target: ModelController, 
  args: any[], 
  main: boolean){

  let lifecycle: any;

  return useSubscription(
    () => {
      lifecycle = main ? 
        componentLifecycle(target) : 
        subscriberLifecycle(target);
  
      return target;
    },
    (name: string, on: ModelController) => {
      const handler = lifecycle[name];
  
      //TODO: callback caching breaks this!
      if(name == "willUpdate"){
        const current = Object.getPrototypeOf(on);
        if(target !== current)
          instanceIsUnexpected(target, current);
      }
  
      if(handler)
        return handler.apply(on, args);
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

