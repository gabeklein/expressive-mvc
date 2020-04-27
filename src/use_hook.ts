import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { useSubscription } from './hook';
import { useSubscriber } from './subscriber';
import { Class, ModelController } from './types';

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

  let lifecycle: any;

  function usingController(){
    const control = 
      typeof model === "function" ?
        model.prototype ?
          new (model as Class)(...args) :
          (model as Function)(...args) :
        model;

    lifecycle = componentLifecycle(control);
    Dispatch.readyFor(control);

    return control;
  };

  function onLifecycleEvent(name: string, on: ModelController){
    const handler = lifecycle[name];

    if(name == "willUnmount")
      if(on.willDestroy)
        on.willDestroy(...args)

    if(handler)
      return handler.apply(on, args);
  }

  return useSubscription(usingController, onLifecycleEvent);
}