import { Controller } from './controller';
import { ensureDispatch } from './dispatch';
import { globalController } from './global';
import { useEventDrivenController } from './hook';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';
import { BunchOf, Callback, Class, LivecycleEvent } from './types';

export const lifecycleEvents = [
  "willReset",
  "willCycle",
  "willRender",
  "willUpdate",
  "willMount",
  "willUnmount",
  "didRender",
  "didMount"
];

const eventsFor = (prefix: string) => {
  const map = {} as BunchOf<string>;
  for(const name of lifecycleEvents)
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);
  return map;
}

export const subscriberLifecycle = eventsFor("element");
export const componentLifecycle = eventsFor("component");

lifecycleEvents.push(
  ...Object.values(subscriberLifecycle),
  ...Object.values(componentLifecycle)
)

export function useModelController(
  model: typeof Controller, 
  args: any[] = [], 
  callback?: (instance: Controller) => void){

  return useEventDrivenController((refresh) => {
    let instance: Controller;
    let release: Callback | undefined;

    if(model.global)
      instance = globalController(model, args);
    else
      instance = newController(model, args);

    const dispatch = ensureDispatch(instance);

    if(callback)
      callback(instance);

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = componentLifecycle[name] as LivecycleEvent;
      const handler = instance[specific] || instance[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.trigger(name, specific);

      switch(name){
        case "willRender":
          release = ensurePeerControllers(this);
        break;

        case "willUnmount": {
          if(release)
            release();

          if(instance.willDestroy)
            instance.willDestroy(...args)
        }
        break;
      }
    }

    return new Subscription(instance, refresh, onEvent).proxy;
  })
}

export function useSubscriber<T extends Controller>(
  target: T,
  args: any[],
  main: boolean){

  return useEventDrivenController((refresh) => {
    const dispatch = ensureDispatch(target);
    
    const lifecycle: any = main
      ? componentLifecycle
      : subscriberLifecycle;

    function onEvent(this: Controller, name: LivecycleEvent){
      const specific = lifecycle[name] as LivecycleEvent;
      const handler = target[specific] || target[name];
      
      if(handler)
        handler.apply(this, args);
        
      dispatch.trigger(name, specific);
    }
    
    return new Subscription(target, refresh, onEvent).proxy;
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