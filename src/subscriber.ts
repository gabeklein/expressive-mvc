import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { NEW_SUB, SUBSCRIBE, UNSUBSCRIBE } from './dispatcher';

export interface SpyController extends Controller {
  [UNSUBSCRIBE]: VoidFunction;
  [SUBSCRIBE]: VoidFunction;
};

export function useSubscriber<T extends Controller | SpyController>
  (controller: T): InstanceType<T> {

  const firstRenderIs = useRef(true);
  const useUpdate = useState(0);

  if(firstRenderIs.current){
    const init = controller[NEW_SUB];
    if(!init){
      const { name } = controller.constructor;
      throw new Error(
        `Can't subscribe to controller;` +
        ` this accessor can only be used within { Provider } given to you by \`${name}.use()\``
      )
    }

    controller = init(useUpdate[1]) as T;
    firstRenderIs.current = false
  }

  useEffect(() => {
    const initialRenderControl = 
      controller as SpyController;

    initialRenderControl[SUBSCRIBE]();
    return () => 
      initialRenderControl[UNSUBSCRIBE]();
  }, [])

  return controller as any;
}