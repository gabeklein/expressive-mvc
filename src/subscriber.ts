import { useEffect, useState } from 'react';

import { Controller } from './controller';
import { componentLifecycle, subscriberLifecycle, useLifecycleEffect } from './lifecycle';
import { Observer } from './observer';
import { ensurePeerControllers } from './peers';
import { Subscription } from './subscription';

type Observable = { getDispatch(): Observer };

function useActiveMemo<T>
  (init: (refresh: Callback) => T){

  const [ state, update ] = useState<any>(() => [
    init(() => update(state.concat()))
  ]);

  return state[0] as T;
}

export function usePassiveSubscriber(
  target: Observable, ...path: string[]){

  const subscription =
    useActiveMemo(refresh => {
      const parent = target.getDispatch();
      return new Subscription(parent, refresh).focus(path);
    });

  useEffect(() => {
    subscription.commit();
    return () => subscription.release();
  }, []);

  return subscription.proxy;
}

export function useActiveSubscriber<T extends Controller>
  (target: T, args: any[]){

  const subscription =
    useActiveMemo(refresh => 
      new Subscription(target.getDispatch(), refresh)
    );

  useLifecycleEffect((name) => {
    const alias = subscriberLifecycle(name);
    const handler = target[alias] || target[name];

    if(name == "didMount")
      subscription.commit();

    if(handler)
      handler.apply(handler, args || []);

    subscription.parent.emit(name, alias);

    if(name == "willUnmount")
      subscription.release();
  });
  
  return subscription.proxy;
}

export function useOwnController<T extends typeof Controller>(
  Model: T,
  args?: any[], 
  callback?: (instance: InstanceType<T>) => void){

  let release: Callback | undefined;

  const subscription = 
    useActiveMemo(refresh => {
      const dispatch = Model.create(args, callback).getDispatch();
      return new Subscription(dispatch, refresh);
    });

  useLifecycleEffect((name) => {
    const alias = componentLifecycle(name);
    const instance = subscription.parent.subject as InstanceType<T>;
    const handler = instance[alias] || instance[name];

    if(name == "willRender")
      release = ensurePeerControllers(instance);

    if(name == "didMount")
      subscription.commit();

    if(handler)
      handler.apply(handler, args || []);

    subscription.parent.emit(name, alias);

    if(name == "willUnmount"){
      subscription.release();

      if(release)
        release();

      instance.destroy();
    }
  });

  return subscription.proxy;
}