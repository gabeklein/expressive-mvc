import { useEffect } from 'react';

import { ensureAttachedControllers } from './bootstrap';
import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { createSubscription, LIFECYCLE, SUBSCRIBE, UNSUBSCRIBE, useManualRefresh, useSubscriber, MAIN } from './subscriber';
import { Class, LifeCycle, ModelController, Callback } from './types';
import { callIfExists as ifExists } from './util';

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

  let event: LifeCycle = cache[LIFECYCLE];
  let releaseHooks: Callback | undefined;
  let control: ModelController = cache[MAIN] || (
    typeof model === "function" ?
      model.prototype ?
        new (model as Class)(...args) :
        (model as Function)(...args) :
      model
    )

  Dispatch.readyFor(control);
  releaseHooks = ensureAttachedControllers(control);

  if(!cache[MAIN]){
    // cache[MAIN] = bindMethods(instance, model.prototype);
    event = cache[LIFECYCLE] = componentLifecycle(control);
    control = cache[MAIN] = createSubscription(control, onShouldUpdate);

    ifExists(event.willMount, control, args);
  }
  else 
    ifExists(event.willUpdate, control, args);

  ifExists(event.willRender, control, args);

  useEffect(() => {
    let endOfLife = ifExists(event.willCycle, control, args);

    ifExists(event.didMount, control, args);
    
    control[SUBSCRIBE]!();

    return () => {
      ifExists(releaseHooks);
      ifExists(event.willUnmount, control, args);
      ifExists(endOfLife);

      control[UNSUBSCRIBE]!();

      ifExists(control.willDestroy, control);
    }
  }, [])

  return control;
}