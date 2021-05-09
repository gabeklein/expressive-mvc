import { useEffect, useMemo } from 'react';

import { values } from './util';

export enum Lifecycle {
  WILL_RESET = "willReset",
  WILL_RENDER = "willRender",
  WILL_UPDATE = "willUpdate",
  WILL_MOUNT = "willMount",
  WILL_UNMOUNT = "willUnmount",
  DID_RENDER = "didRender",
  DID_MOUNT = "didMount"
};

type ValuesIn<T> = T[keyof T];

function aliasFor(prefix: string){
  const map = {} as BunchOf<string>;

  for(const name of values(Lifecycle))
    map[name] = prefix + name[0].toUpperCase() + name.slice(1);

  return (name: string) => map[name] as ValuesIn<typeof Lifecycle>;
}

export const subscriberLifecycle = aliasFor("element");
export const componentLifecycle = aliasFor("component");

export function useLifecycleEffect(
  onEvent: (name: ValuesIn<typeof Lifecycle>) => void){

  let isFirstRender: true | undefined;

  const event = useMemo(() => {
    isFirstRender = true;
    return onEvent;
  }, []);

  event(isFirstRender ? Lifecycle.WILL_MOUNT : Lifecycle.WILL_UPDATE);
  event(Lifecycle.WILL_RENDER);

  useEffect(() => {
    event(Lifecycle.DID_RENDER);
    return () => event(Lifecycle.WILL_RESET);
  })

  useEffect(() => {
    event(Lifecycle.DID_MOUNT);
    return () => event(Lifecycle.WILL_UNMOUNT);
  }, [])
}