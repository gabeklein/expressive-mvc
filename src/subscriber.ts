import { useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { NEW_SUB, SUBSCRIBE, UNSUBSCRIBE } from './subscription';

export interface SpyController extends Controller {
  [UNSUBSCRIBE]: () => void;
  [SUBSCRIBE]: () => void;
};

export function useSubscriber<T extends Controller | SpyController>
  (controller: T){

  const firstRenderIs = useRef(true);
  const useUpdate = useState(0);

  if(firstRenderIs.current){
    const subscribe = controller[NEW_SUB];
    if(!subscribe){
      const { name } = controller.constructor;
      throw new Error(
        `Can't subscribe to controller;` +
        ` this accessor can only be used within { Provider } given to you by \`${name}.use()\``
      )
    }

    controller = subscribe(useUpdate[1]) as any;
    firstRenderIs.current = false
  }

  useEffect(() => {
    const initialRenderControl = 
      controller as SpyController;

    initialRenderControl[SUBSCRIBE]();
    return () => 
      initialRenderControl[UNSUBSCRIBE]();
  }, [])

  return controller;
}