import { Controller } from './controller';
import { lifecycleEvents, LivecycleEvent, useEventDrivenController } from './hook';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

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
    let instance = model.create(args);
    let release: Callback | undefined;

    const dispatch = instance.initialize();

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

          instance.destroy();
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
    const dispatch = target.initialize();
    
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