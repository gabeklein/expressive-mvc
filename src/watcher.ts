import { useEffect } from 'react';

import { useManualRefresh } from './hook';
import { Observable } from './observer';
import { getSubscriber, Subscription } from './subscription';

export function useWatcher(control: Observable){
  const [ cache, onDidUpdate ] = useManualRefresh<any>();

  let { current } = cache;
  
  if(!current){
    const subscribe = new Subscription(control, onDidUpdate);
    current = cache.current = subscribe.proxy;
  }

  useEffect(() => {
    const subscribe = getSubscriber(current);

    subscribe.start();
    return () => subscribe.stop();
  }, []);

  return current;
}