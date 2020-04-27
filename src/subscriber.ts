import { useSubscription } from './hook';
import { ModelController } from './types';
import { componentLifecycle } from './use_hook';
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

export function useSubscriber(
  target: ModelController, 
  args: any[], 
  main: boolean){

  let lifecycle: any;

  function usingController(){
    lifecycle = main ? 
      componentLifecycle(target) : 
      subscriberLifecycle(target);

    return target;
  };

  function onLifecycleEvent(name: string, on: ModelController){
    if(!lifecycle)
      debugger

    const handler = lifecycle[name];

    if(name == "willUpdate"){
      const current = Object.getPrototypeOf(on);
      if(target !== current)
        instanceIsUnexpected(target, current);
    }

    if(handler)
      return handler.apply(on, args);
  }

  return useSubscription(usingController, onLifecycleEvent);
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

