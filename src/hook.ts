import { useEffect, useState } from 'react';

import { ensureAttachedControllers } from './bootstrap';
import { Dispatch } from './dispatch';
import { createSubscription, SUBSCRIBE, UNSUBSCRIBE } from './subscription';
import { Callback, ModelController } from './types';

export const useManualRefresh = () => {
  const [ state, update ] = useState({} as any);
  const refresh = () => update(Object.assign({}, state));
  return [ state, refresh ] as const;
}

export function useSubscription(
  init: () => ModelController,
  onEvent: (name: string, local: ModelController) => any
){
  const [ cache, onShouldUpdate ] = useManualRefresh();
  
  let control: ModelController = cache.current;
  let trigger = cache.eventListener;
  let releaseHooks: Callback | undefined;
  
  if(!control){
    control = init();
    trigger = cache.eventListener = onEvent;
    Dispatch.readyFor(control);
  }

  releaseHooks = ensureAttachedControllers(control);

  if(!cache.current){
    control = cache.current = 
      createSubscription(control, onShouldUpdate) as any;

    trigger("willMount", control);
  }
  else
    trigger("willUpdate", control);

  trigger("willRender", control);

  useEffect(() => {
    let onEndOfLife = trigger("willCycle", control);

    trigger("didMount", control);

    control[SUBSCRIBE]!();

    return () => {
      control[UNSUBSCRIBE]!();

      if(releaseHooks)
        releaseHooks();

      trigger("willUnmount", control);

      if(typeof onEndOfLife === "function")
        onEndOfLife();
    };
  }, [])

  return control;
}