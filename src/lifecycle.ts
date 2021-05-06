import type { WithLifecycle } from '..'

import { useEffect, useMemo } from 'react';

import { values } from './util';

export const lifecycle = {
  WILL_RESET: "willReset",
  WILL_RENDER: "willRender",
  WILL_UPDATE: "willUpdate",
  WILL_MOUNT: "willMount",
  WILL_UNMOUNT: "willUnmount",
  DID_RENDER: "didRender",
  DID_MOUNT: "didMount"
} as const;

function aliasFor(prefix: string){
  const map = {} as BunchOf<string>;

  for(const name of values(lifecycle))
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);

  return (name: string) => map[name] as keyof WithLifecycle;
}

export const subscriberLifecycle = aliasFor("element");
export const componentLifecycle = aliasFor("component");

export function useLifecycleEffect(
  onEvent: (name: keyof WithLifecycle) => void){

  let isFirstRender: true | undefined;

  const event = useMemo(() => {
    isFirstRender = true;
    return onEvent;
  }, []);

  event(isFirstRender ? lifecycle.WILL_MOUNT : lifecycle.WILL_UPDATE);
  event(lifecycle.WILL_RENDER);

  useEffect(() => {
    event(lifecycle.DID_RENDER);
    return () => event(lifecycle.WILL_RESET);
  })

  useEffect(() => {
    event(lifecycle.DID_MOUNT);
    return () => event(lifecycle.WILL_UNMOUNT);
  }, [])
}